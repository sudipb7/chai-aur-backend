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
router.route("/avatar").patch(verifyJWT, upload.single("avatar"), updateAvatar);
router
  .route("/cover-image")
  .patch(verifyJWT, upload.single("coverImage"), updateCoverImage);

router.route("/login").post(login);
router.route("/logout").post(verifyJWT, logout);
router.route("/refresh-token").post(refreshAccessToken);
router.route("/change-password").post(verifyJWT, changeCurrentPassword);
router.route("/current-user").get(verifyJWT, getCurrentUser);
router.route("/update-profile").patch(verifyJWT, updateUser);
router.route("/channel/:username").get(verifyJWT, getChannelprofile);
router.route("/history").get(verifyJWT, getWatchHistory);

export default router;
