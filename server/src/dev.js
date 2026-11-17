const serverPort = process.env.SERVER_PORT;

require('dotenv').config();

process.env.SERVER_PORT = serverPort || process.env.DEV_PORT || '5001';

require('./index');