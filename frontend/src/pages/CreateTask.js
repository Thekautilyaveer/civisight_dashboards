import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

const CreateTask = () => {
  const [counties, setCounties] = useState([]);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    countyIds: [],
    deadline: '',
    priority: 'medium',
  });
  const [formFile, setFormFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCounties();
  }, []);

  const fetchCounties = async () => {
    try {
      const res = await api.get('/counties');
      setCounties(res.data);
    } catch (error) {
      console.error('Error fetching counties:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (taskForm.countyIds.length === 0) {
      alert('Please select at least one county');
      return;
    }

    setUploading(true);
    try {
      const response = await api.post('/tasks/bulk', {
        ...taskForm,
        deadline: new Date(taskForm.deadline).toISOString(),
      });

      // Upload form file if provided (to all tasks)
      if (formFile && response.data.tasks && response.data.tasks.length > 0) {
        const formData = new FormData();
        formData.append('formFile', formFile);
        
        const token = localStorage.getItem('token');
        let uploadSuccessCount = 0;
        let uploadErrors = [];
        
        // Upload to all tasks
        for (let i = 0; i < response.data.tasks.length; i++) {
          try {
            const uploadResponse = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5001/api'}/tasks/${response.data.tasks[i]._id}/upload-form`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`
              },
              body: formData
            });
            
            if (!uploadResponse.ok) {
              const errorData = await uploadResponse.json().catch(() => ({ message: 'Upload failed' }));
              uploadErrors.push(`Task ${i + 1}: ${errorData.message || 'Upload failed'}`);
              // console.error(`Failed to upload form for task ${response.data.tasks[i]._id}:`, errorData);
            } else {
              uploadSuccessCount++;
            }
          } catch (uploadError) {
            uploadErrors.push(`Task ${i + 1}: ${uploadError.message || 'Network error'}`);
            // console.error(`Error uploading form for task ${response.data.tasks[i]._id}:`, uploadError);
          }
        }
        
        if (uploadErrors.length > 0) {
          alert(`Tasks created successfully! However, ${uploadErrors.length} file upload(s) failed. ${uploadSuccessCount} upload(s) succeeded.`);
        } else {
          alert('Tasks created and files uploaded successfully!');
        }
      } else {
        alert('Tasks created successfully!');
      }
      
      navigate('/dashboard');
    } catch (error) {
      alert(error.response?.data?.message || 'Error creating tasks');
    } finally {
      setUploading(false);
    }
  };

  const handleCountyToggle = (countyId) => {
    setTaskForm((prev) => ({
      ...prev,
      countyIds: prev.countyIds.includes(countyId)
        ? prev.countyIds.filter((id) => id !== countyId)
        : [...prev.countyIds, countyId],
    }));
  };

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Create Task</h1>
        <p className="mt-2 text-sm text-gray-600">Assign a new task to one or more counties</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Task Title *
            </label>
            <input
              type="text"
              required
              value={taskForm.title}
              onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter task title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={taskForm.description}
              onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows="4"
              placeholder="Enter task description"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Counties *
            </label>
            <div className="border border-gray-300 rounded-lg p-4 max-h-64 overflow-y-auto">
              {counties.length === 0 ? (
                <p className="text-gray-500 text-sm">No counties available</p>
              ) : (
                counties.map((county) => (
                  <label
                    key={county._id}
                    className="flex items-center space-x-3 py-2 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={taskForm.countyIds.includes(county._id)}
                      onChange={() => handleCountyToggle(county._id)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-900">{county.name}</span>
                  </label>
                ))
              )}
            </div>
            {taskForm.countyIds.length > 0 && (
              <p className="mt-2 text-sm text-gray-500">
                {taskForm.countyIds.length} county{taskForm.countyIds.length !== 1 ? 'ies' : ''} selected
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Deadline *
              </label>
              <input
                type="datetime-local"
                required
                value={taskForm.deadline}
                onChange={(e) => setTaskForm({ ...taskForm, deadline: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority *
              </label>
              <select
                value={taskForm.priority}
                onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Form File (Optional)
            </label>
            <input
              type="file"
              onChange={(e) => setFormFile(e.target.files[0])}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png"
            />
            <p className="mt-1 text-xs text-gray-500">
              Upload a form file that counties can download and fill out
            </p>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={uploading || taskForm.countyIds.length === 0}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Creating...' : 'Create Task'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTask;

