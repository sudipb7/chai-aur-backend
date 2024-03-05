import multer from "multer";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public/temp");
  },
  filename: function (req, file, cb) {
    const mimetype = file.mimetype.split("/")[1];
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const fileName = `${file.filename}-${file.originalname}-${uniqueSuffix}.${mimetype}`;
    cb(null, fileName);
  },
});

export const upload = multer({ storage });
