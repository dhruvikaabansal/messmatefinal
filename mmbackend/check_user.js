const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const checkUser = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const user = await User.findOne({ email: 'bansaldhruvika8@gmail.com' });
        if (user) {
            console.log('USER_EXISTS');
        } else {
            console.log('USER_NOT_FOUND');
        }
        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

checkUser();
