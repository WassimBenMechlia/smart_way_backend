const AppError = require('../utils/appError');
const catchasync = require('../utils/catchAsync');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

exports.uploadAnyFilesFields = (fields) => {
  return multer({
    storage: multer.memoryStorage(),
  }).fields(fields);
};

exports.saveAnyFilesFields = (fieldsToFolders) => {
  return catchasync(async (req, res, next) => {
    if (!req.files) return next();
    console.log('-----------------------------')
    const files = {};
    const originalFiles = {};

    for (const field in fieldsToFolders) {
      if (!fs.existsSync(`public/${fieldsToFolders[field]}`)) {
        fs.mkdirSync(`public/${fieldsToFolders[field]}`, { recursive: true });
      }
    }

    for (const field in fieldsToFolders) {
      if (req.files[field]) {
        const folder = fieldsToFolders[field];
        const fieldFiles = [];
        const originalFieldFiles = [];

        req.files[field].forEach((file) => {

          file.filename = `${uuidv4()}-${Date.now()}.${file.originalname
            .split('.')
            .pop()}`;

          fieldFiles.push(file.filename);
          originalFieldFiles.push(file.originalname);

          fs.writeFile(
            `public/${folder}/${file.filename}`,
            file.buffer,
            (err) => {
              if (err) {
                console.log(err);
              }
            }
          );
        });

        files[field] = fieldFiles;
        originalFiles[field] = originalFieldFiles;
      }
    }

    req.body.files = files;
    req.body.originalFiles = originalFiles;

    next();
  });
};
