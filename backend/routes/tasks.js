const express = require('express');
const router = express.Router();
const { auth, adminOnly } = require('../middleware/auth');
const Task = require('../models/Task');
const County = require('../models/County');
const Notification = require('../models/Notification');
const { body, validationResult } = require('express-validator');
const { uploadForm, uploadFilledForm, getSignedUrl, deleteFile } = require('../middleware/upload');
const { sendReminderEmail, sendTaskAssignmentEmail, sendFormUploadEmail } = require('../utils/email');
const User = require('../models/User');
const logger = require('../utils/logger');

// @route   GET /api/tasks
// @desc    Get all tasks (filtered by county for county users)
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    let query = {};
    
    // County users only see tasks for their county
    if (req.user.role !== 'admin') {
      if (!req.user.countyId) {
        return res.json([]);
      }
      query.countyId = req.user.countyId;
    }

    // Filter by county if provided
    if (req.query.countyId) {
      query.countyId = req.query.countyId;
    }

    // Filter by status if provided
    if (req.query.status) {
      query.status = req.query.status;
    }

    // Filter by priority if provided
    if (req.query.priority) {
      query.priority = req.query.priority;
    }

    // Filter by deadline date range
    if (req.query.deadlineFrom || req.query.deadlineTo) {
      query.deadline = {};
      if (req.query.deadlineFrom) {
        query.deadline.$gte = new Date(req.query.deadlineFrom);
      }
      if (req.query.deadlineTo) {
        query.deadline.$lte = new Date(req.query.deadlineTo);
      }
    }

    // Filter by assigned date range
    if (req.query.assignedFrom || req.query.assignedTo) {
      query.createdAt = {};
      if (req.query.assignedFrom) {
        query.createdAt.$gte = new Date(req.query.assignedFrom);
      }
      if (req.query.assignedTo) {
        query.createdAt.$lte = new Date(req.query.assignedTo);
      }
    }

    // Search by title or description
    if (req.query.search) {
      query.$or = [
        { title: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const tasks = await Task.find(query)
      .populate('countyId', 'name code')
      .populate('assignedBy', 'username email')
      .sort({ deadline: 1, createdAt: -1 });

    res.json(tasks);
  } catch (error) {
    logger.error('Error fetching tasks:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/tasks/:id
// @desc    Get single task by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('countyId', 'name code')
      .populate('assignedBy', 'username email');

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if user has access
    if (req.user.role !== 'admin' && req.user.countyId?.toString() !== task.countyId._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(task);
  } catch (error) {
    logger.error('Error fetching task:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/tasks
// @desc    Create a new task
// @access  Private (Admin only)
router.post('/', auth, adminOnly, [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('countyId').notEmpty().withMessage('County ID is required'),
  body('deadline').isISO8601().withMessage('Valid deadline is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, countyId, status, deadline } = req.body;

    // Verify county exists
    const county = await County.findById(countyId);
    if (!county) {
      return res.status(404).json({ message: 'County not found' });
    }

    const task = new Task({
      title,
      description: description || '',
      countyId,
      status: status || 'pending',
      priority: req.body.priority || 'medium',
      deadline: new Date(deadline),
      assignedBy: req.user._id
    });

    await task.save();

    // Send email notification to county
    try {
      const populatedCounty = await County.findById(countyId);
      const assignedByUser = await User.findById(req.user._id);
      
      if (populatedCounty && populatedCounty.email) {
        await sendTaskAssignmentEmail(
          populatedCounty.email,
          populatedCounty.name,
          title,
          deadline,
          assignedByUser.username
        );
        logger.info(`Task assignment email sent to ${populatedCounty.email}`);
      }
    } catch (emailError) {
      logger.error('Failed to send task assignment email:', emailError);
      // Continue even if email fails
    }

    // Create notification for county users
    const Notification = require('../models/Notification');
    const countyUsers = await User.find({ countyId: countyId, role: 'county_user' });
    for (const user of countyUsers) {
      const notification = new Notification({
        userId: user._id,
        type: 'task_assigned',
        title: 'New Task Assigned',
        message: `New task assigned: ${title}`,
        taskId: task._id
      });
      await notification.save();
    }

    const populatedTask = await Task.findById(task._id)
      .populate('countyId', 'name code email')
      .populate('assignedBy', 'username email');

    res.status(201).json(populatedTask);
  } catch (error) {
    logger.error('Error creating task:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/tasks/bulk
// @desc    Create tasks for multiple counties
// @access  Private (Admin only)
router.post('/bulk', auth, adminOnly, [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('countyIds').isArray().withMessage('County IDs must be an array'),
  body('countyIds.*').isMongoId().withMessage('Each county ID must be a valid MongoDB ObjectId'),
  body('deadline').isISO8601().withMessage('Valid deadline is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, countyIds, status, deadline, priority } = req.body;

    // Verify all counties exist
    const counties = await County.find({ _id: { $in: countyIds } });
    if (counties.length !== countyIds.length) {
      return res.status(404).json({ message: 'One or more counties not found' });
    }

    // Create tasks for each county
    const tasks = countyIds.map(countyId => ({
      title,
      description: description || '',
      countyId,
      status: status || 'pending',
      priority: priority || 'medium',
      deadline: new Date(deadline),
      assignedBy: req.user._id
    }));

    const createdTasks = await Task.insertMany(tasks);

    // Send email notifications for each task
    const assignedByUser = await User.findById(req.user._id);
    for (const createdTask of createdTasks) {
      try {
        const county = await County.findById(createdTask.countyId);
        if (county && county.email) {
          await sendTaskAssignmentEmail(
            county.email,
            county.name,
            title,
            deadline,
            assignedByUser.username
          );
        }
        
        // Create notifications for county users
        const Notification = require('../models/Notification');
        const countyUsers = await User.find({ countyId: createdTask.countyId, role: 'county_user' });
        for (const user of countyUsers) {
          const notification = new Notification({
            userId: user._id,
            type: 'task_assigned',
            title: 'New Task Assigned',
            message: `New task assigned: ${title}`,
            taskId: createdTask._id
          });
          await notification.save();
        }
      } catch (emailError) {
        logger.error(`Failed to send emails for task ${createdTask._id}:`, emailError);
      }
    }

    // Populate the created tasks
    const populatedTasks = await Task.find({ _id: { $in: createdTasks.map(t => t._id) } })
      .populate('countyId', 'name code email')
      .populate('assignedBy', 'username email');

    res.status(201).json({ 
      message: `Created ${createdTasks.length} tasks successfully`,
      tasks: populatedTasks 
    });
  } catch (error) {
    logger.error('Error creating bulk tasks:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/tasks/:id
// @desc    Update a task
// @access  Private
router.put('/:id', auth, [
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
  body('deadline').optional().isISO8601().withMessage('Valid deadline is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if user has access (admin or county user for their county)
    if (req.user.role !== 'admin' && req.user.countyId?.toString() !== task.countyId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { title, description, status, deadline } = req.body;

    if (title) task.title = title;
    if (description !== undefined) task.description = description;
    if (status) task.status = status;
    if (req.body.priority) task.priority = req.body.priority;
    if (deadline) task.deadline = new Date(deadline);

    await task.save();

    const populatedTask = await Task.findById(task._id)
      .populate('countyId', 'name code')
      .populate('assignedBy', 'username email');

    res.json(populatedTask);
  } catch (error) {
    logger.error('Error updating task:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/tasks/:id
// @desc    Delete a task
// @access  Private (Admin only)
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Delete related notifications
    await Notification.deleteMany({ taskId: req.params.id });

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    logger.error('Error deleting task:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/tasks/:id/reminder
// @desc    Send reminder for a task
// @access  Private (Admin only)
router.post('/:id/reminder', auth, adminOnly, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('countyId', 'name code email');
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Determine email address - use county email if available, otherwise fallback
    const emailTo = task.countyId.email || process.env.EMAIL_TO || 'thekautilyaveer@gmail.com';

    // Send email
    try {
      await sendReminderEmail(
        emailTo,
        task.countyId.name,
        task.title,
        task.deadline
      );
      logger.info(`Reminder email sent successfully to ${emailTo}`);
    } catch (emailError) {
      logger.error('Failed to send reminder email:', emailError);
      // Continue even if email fails - still record the reminder
    }

    // Add reminder record
    task.reminders.push({
      sentAt: new Date(),
      sentBy: req.user._id
    });

    await task.save();

    // Create notification
    const notification = new Notification({
      userId: req.user._id,
      type: 'reminder',
      title: 'Reminder Sent',
      message: `Reminder sent for task: ${task.title}`,
      taskId: task._id
    });

    await notification.save();

    res.json({ 
      message: 'Reminder sent successfully',
      task: await Task.findById(task._id).populate('countyId', 'name code email')
    });
  } catch (error) {
    logger.error('Error sending reminder:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/tasks/:id/upload-form
// @desc    Upload form file for a task (admin only)
// @access  Private (Admin only)
router.post('/:id/upload-form', auth, adminOnly, uploadForm, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Check if file upload was successful (S3 key should exist)
    if (!req.file.key) {
      logger.error('File upload failed - no S3 key returned', { file: req.file });
      return res.status(500).json({ message: 'File upload failed. Please check S3 configuration.' });
    }

    // Delete old form file if exists
    if (task.formFile && task.formFile.filePath) {
      await deleteFile(task.formFile.filePath);
    }

    // Store S3 key as file path
    task.formFile = {
      originalName: req.file.originalname,
      fileName: req.file.key,
      filePath: req.file.key,
      uploadedAt: new Date()
    };

    await task.save();

    // Send email notification to county
    try {
      const populatedTask = await Task.findById(task._id)
        .populate('countyId', 'name code email');
      
      if (populatedTask.countyId && populatedTask.countyId.email) {
        await sendFormUploadEmail(
          populatedTask.countyId.email,
          populatedTask.countyId.name,
          populatedTask.title,
          req.file.originalname
        );
        logger.info(`Form upload notification sent to ${populatedTask.countyId.email}`);
      }
      
      // Create notifications for county users
      const Notification = require('../models/Notification');
      const countyUsers = await User.find({ countyId: task.countyId, role: 'county_user' });
      for (const user of countyUsers) {
        const notification = new Notification({
          userId: user._id,
          type: 'task_assigned',
          title: 'Form Available',
          message: `Form available for task: ${populatedTask.title}`,
          taskId: task._id
        });
        await notification.save();
      }
    } catch (emailError) {
      logger.error('Failed to send form upload email:', emailError);
    }

    const populatedTask = await Task.findById(task._id)
      .populate('countyId', 'name code email')
      .populate('assignedBy', 'username email');

    res.json({ message: 'Form uploaded successfully', task: populatedTask });
  } catch (error) {
    logger.error('Error uploading form:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/tasks/:id/upload-filled-form
// @desc    Upload filled form file (county users)
// @access  Private
router.post('/:id/upload-filled-form', auth, uploadFilledForm, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if user has access
    if (req.user.role !== 'admin' && req.user.countyId?.toString() !== task.countyId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Check if file upload was successful (S3 key should exist)
    if (!req.file.key) {
      logger.error('File upload failed - no S3 key returned', { file: req.file });
      return res.status(500).json({ message: 'File upload failed. Please check S3 configuration.' });
    }

    // Delete old filled form file if exists
    if (task.filledFormFile && task.filledFormFile.filePath) {
      await deleteFile(task.filledFormFile.filePath);
    }

    // Store S3 key as file path
    task.filledFormFile = {
      originalName: req.file.originalname,
      fileName: req.file.key,
      filePath: req.file.key,
      uploadedAt: new Date(),
      uploadedBy: req.user._id
    };

    await task.save();

    const populatedTask = await Task.findById(task._id)
      .populate('countyId', 'name code')
      .populate('assignedBy', 'username email');

    res.json({ message: 'Filled form uploaded successfully', task: populatedTask });
  } catch (error) {
    logger.error('Error uploading filled form:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
});

// @route   GET /api/tasks/:id/download-form
// @desc    Download form file
// @access  Private
router.get('/:id/download-form', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task || !task.formFile) {
      return res.status(404).json({ message: 'Form file not found' });
    }

    // Check if user has access
    if (req.user.role !== 'admin' && req.user.countyId?.toString() !== task.countyId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Generate signed URL for S3 file
    const signedUrl = await getSignedUrl(task.formFile.filePath);
    if (!signedUrl) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    // Return signed URL as JSON instead of redirecting
    res.json({ 
      downloadUrl: signedUrl,
      fileName: task.formFile.originalName || 'form.pdf'
    });
  } catch (error) {
    logger.error('Error downloading form:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/tasks/:id/download-filled-form
// @desc    Download filled form file
// @access  Private
router.get('/:id/download-filled-form', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task || !task.filledFormFile) {
      return res.status(404).json({ message: 'Filled form file not found' });
    }

    // Check if user has access
    if (req.user.role !== 'admin' && req.user.countyId?.toString() !== task.countyId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Generate signed URL for S3 file
    const signedUrl = await getSignedUrl(task.filledFormFile.filePath);
    if (!signedUrl) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    // Return signed URL as JSON instead of redirecting
    res.json({ 
      downloadUrl: signedUrl,
      fileName: task.filledFormFile.originalName || 'filled-form.pdf'
    });
  } catch (error) {
    logger.error('Error downloading filled form:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

