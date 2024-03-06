import { Router } from "express";

import {
  changeCurrentPassword,
  login,
  logout,
  refreshAccessToken,
  register,
  getChannelprofile,
  getCurrentUser,
  getWatchHistory,
  updateAvatar,
  updateCoverImage,
  updateUser,
} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/register").post(
  upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "coverImage", maxCount: 1 },
  ]),
  register
);
router.route("/login").post(login);
router.route("/logout").post(verifyJWT, logout);

router.route("/avatar").patch(verifyJWT, upload.single("avatar"), updateAvatar);
router
  .route("/cover")
  .patch(verifyJWT, upload.single("coverImage"), updateCoverImage);

router.route("/").get(verifyJWT, getCurrentUser).patch(verifyJWT, updateUser);
router.route("/refresh").post(refreshAccessToken);
router.route("/password").post(verifyJWT, changeCurrentPassword);
router.route("/c/:username").get(verifyJWT, getChannelprofile);
router.route("/history").get(verifyJWT, getWatchHistory);

export default router;
