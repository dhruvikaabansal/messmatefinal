const axios = require('axios');

const testReg = async () => {
    try {
        const res = await axios.post('http://localhost:5000/api/auth/register', {
            name: 'Dhruvika',
            email: 'dhruvika_test_' + Date.now() + '@gmail.com',
            password: 'password123',
            college: 'NIIT University'
        });
        console.log('SUCCESS:', res.data);
    } catch (err) {
        console.error('FAILED:', err.response?.data || err.message);
    }
};

testReg();
