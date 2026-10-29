const { S3Client } = require('@aws-sdk/client-s3');
require('dotenv').config();

const s3Config = {
  region: process.env.AWS_REGION || 'us-east-1',
};

const accessKey = process.env.AWS_ACCESS_KEY_ID;
const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
const isDummy = !accessKey || accessKey === 'dummy' || accessKey.includes('tu_access_key');

if (!isDummy && secretKey) {
  s3Config.credentials = {
    accessKeyId: accessKey,
    secretAccessKey: secretKey,
  };
}

if (process.env.S3_ENDPOINT) {
  s3Config.endpoint = process.env.S3_ENDPOINT;
  s3Config.forcePathStyle = true;
}

const s3Client = new S3Client(s3Config);

module.exports = s3Client;
