const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const County = require('./models/County');
const Task = require('./models/Task');
const logger = require('./utils/logger');

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/civisight';

const counties = [
  { name: 'Fulton County', code: 'FULTON', description: 'Largest county in Georgia', email: 'thekautilyaveer@gmail.com' },
  { name: 'Gwinnett County', code: 'GWINNETT', description: 'Second most populous county', email: 'thekautilyaveer@gmail.com' },
  { name: 'Cobb County', code: 'COBB', description: 'Third most populous county', email: 'thekautilyaveer@gmail.com' },
  { name: 'DeKalb County', code: 'DEKALB', description: 'Fourth most populous county', email: 'thekautilyaveer@gmail.com' },
  { name: 'Clayton County', code: 'CLAYTON', description: 'Fifth most populous county', email: 'thekautilyaveer@gmail.com' },
  { name: 'Chatham County', code: 'CHATHAM', description: 'Coastal county including Savannah', email: 'thekautilyaveer@gmail.com' },
  { name: 'Richmond County', code: 'RICHMOND', description: 'Includes Augusta', email: 'thekautilyaveer@gmail.com' },
  { name: 'Muscogee County', code: 'MUSCOGEE', description: 'Includes Columbus', email: 'thekautilyaveer@gmail.com' },
  { name: 'Bibb County', code: 'BIBB', description: 'Includes Macon', email: 'thekautilyaveer@gmail.com' },
  { name: 'Hall County', code: 'HALL', description: 'Includes Gainesville', email: 'thekautilyaveer@gmail.com' }
];

const seedData = async () => {
  try {
    await mongoose.connect(MONGODB_URI);

    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await County.deleteMany({});
    await Task.deleteMany({});

    console.log('Cleared existing data');

    // Create counties
    const createdCounties = await County.insertMany(counties);
    console.log(`Created ${createdCounties.length} counties`);

    // Create admin user
    const admin = new User({
      username: 'admin',
      email: 'admin@civisight.org',
      password: 'admin123',
      role: 'admin'
    });
    await admin.save();
    console.log('Created admin user (email: admin@civisight.org, password: admin123)');

    // Create a county user for each county
// Create a county user for each county
    const countyUsers = [];
    for (const county of createdCounties) {
      const countyName = county.name.toLowerCase().replace(/\s+/g, '');
      const countyUser = new User({
        username: `${countyName}_user`,
        email: `${countyName}@civisight.org`,
        password: 'county123',
        role: 'county_user',
        countyId: county._id
      });
      await countyUser.save();
      countyUsers.push(countyUser);
    }

    console.log(`Created ${countyUsers.length} county users`);
    console.log('\nCounty user credentials:');
    countyUsers.forEach(user => {
      console.log(`  ${user.email} / county123 (${user.username})`);
    });

    // Create some sample tasks
    const tasks = [
      {
        title: 'Annual Budget Review',
        description: 'Review and approve the annual budget for the upcoming fiscal year',
        countyId: createdCounties[0]._id,
        status: 'pending',
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        assignedBy: admin._id
      },
      {
        title: 'Infrastructure Assessment',
        description: 'Complete assessment of county infrastructure needs',
        countyId: createdCounties[0]._id,
        status: 'in_progress',
        deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
        assignedBy: admin._id
      },
      {
        title: 'Public Safety Report',
        description: 'Submit quarterly public safety report',
        countyId: createdCounties[1]._id,
        status: 'pending',
        deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
        assignedBy: admin._id
      },
      {
        title: 'Zoning Ordinance Update',
        description: 'Review and update zoning ordinances',
        countyId: createdCounties[2]._id,
        status: 'completed',
        deadline: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        assignedBy: admin._id
      },
      {
        title: 'Environmental Compliance',
        description: 'Ensure compliance with environmental regulations',
        countyId: createdCounties[3]._id,
        status: 'pending',
        deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
        assignedBy: admin._id
      }
    ];

    await Task.insertMany(tasks);
    console.log(`Created ${tasks.length} sample tasks`);

    console.log('Seed data created successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('Error seeding data:', error);
    console.error('Error seeding data:', error.message);
    process.exit(1);
  }
};

seedData();

