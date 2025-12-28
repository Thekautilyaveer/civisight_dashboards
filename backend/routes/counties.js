const express = require('express');
const router = express.Router();
const { auth, adminOnly } = require('../middleware/auth');
const County = require('../models/County');
const Task = require('../models/Task');

// @route   GET /api/counties
// @desc    Get all counties with task statistics
// @access  Private (Admin only for full list, county users see their county)
router.get('/', auth, async (req, res) => {
  try {
    let counties;
    
    if (req.user.role === 'admin') {
      counties = await County.find().sort({ name: 1 });
    } else {
      // County users only see their own county
      if (!req.user.countyId) {
        return res.json([]);
      }
      counties = await County.find({ _id: req.user.countyId });
    }

    // Get task statistics for each county
    const countiesWithStats = await Promise.all(
      counties.map(async (county) => {
        const tasks = await Task.find({ countyId: county._id });
        const pending = tasks.filter(t => t.status === 'pending').length;
        const inProgress = tasks.filter(t => t.status === 'in_progress').length;
        const completed = tasks.filter(t => t.status === 'completed').length;

        return {
          ...county.toObject(),
          taskStats: {
            total: tasks.length,
            pending,
            inProgress,
            completed
          }
        };
      })
    );

    res.json(countiesWithStats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/counties/:id
// @desc    Get single county by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const county = await County.findById(req.params.id);
    if (!county) {
      return res.status(404).json({ message: 'County not found' });
    }

    // Check if user has access (admin or county user for their county)
    if (req.user.role !== 'admin' && req.user.countyId?.toString() !== req.params.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(county);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/counties
// @desc    Create a new county
// @access  Private (Admin only)
router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const { name, code, description } = req.body;

    const county = new County({
      name,
      code,
      description: description || ''
    });

    await county.save();
    res.status(201).json(county);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'County with this name or code already exists' });
    }
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/counties/:id
// @desc    Update a county
// @access  Private (Admin only)
router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    const { name, code, description } = req.body;

    const county = await County.findByIdAndUpdate(
      req.params.id,
      { name, code, description },
      { new: true, runValidators: true }
    );

    if (!county) {
      return res.status(404).json({ message: 'County not found' });
    }

    res.json(county);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/counties/:id
// @desc    Delete a county
// @access  Private (Admin only)
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    const county = await County.findByIdAndDelete(req.params.id);
    if (!county) {
      return res.status(404).json({ message: 'County not found' });
    }

    // Also delete all tasks for this county
    await Task.deleteMany({ countyId: req.params.id });

    res.json({ message: 'County deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

