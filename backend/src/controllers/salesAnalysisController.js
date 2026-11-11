const multer = require("multer");
const path = require("path");

const {
  analyzeSalesCsv,
} = require("../services/salesAnalysisService");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();

    if (extension !== ".csv") {
      return callback(new Error("Only CSV files are allowed"));
    }

    callback(null, true);
  },
});

const uploadCsv = (req, res, next) => {
  upload.single("file")(req, res, (error) => {
    if (error) {
      if (error instanceof multer.MulterError) {
        const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;

        return res.status(status).json({
          success: false,
          message:
            error.code === "LIMIT_FILE_SIZE"
              ? "CSV file must not exceed 5 MB"
              : error.message,
        });
      }

      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    next();
  });
};

const analyzeSalesCsvController = (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a CSV file",
      });
    }

    const analysis = analyzeSalesCsv(req.file.buffer);

    return res.status(200).json({
      success: true,
      message: "Sales data analyzed successfully",
      analysis,
    });
  } catch (error) {
    console.error("Sales analysis error:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to analyze sales data",
    });
  }
};

module.exports = {
  uploadCsv,
  analyzeSalesCsvController,
};
