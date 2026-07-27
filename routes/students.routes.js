// routes/students.routes.js
const express = require('express');
const multer = require('multer');
const upload = require('../middleware/upload');
const auth = require('../middleware/auth');
const controller = require('../controllers/students.controller');

const router = express.Router();

// Sample CSV / search / export are read-oriented and safe to leave
// public-ish behind the same auth gate as the rest of the module.
router.get('/sample-csv', controller.downloadSample);
router.get('/export', auth, controller.exportStudents);
router.get('/import-history', auth, controller.importHistory);
router.get('/', auth, controller.listStudents);

router.post('/check-duplicates', auth, controller.checkDuplicates);

router.post(
  '/import',
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  },
  controller.importStudents
);

module.exports = router;
