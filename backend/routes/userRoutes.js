const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { allowRoles } = require('../middleware/roleMiddleware')
const { upload } = require('../config/cloudinary')
const {
  getAllUsers, getProfile, updateProfile,
  changePassword, uploadAvatar
} = require('../controllers/userController')

router.get('/', protect, allowRoles('admin'), getAllUsers)
router.get('/profile', protect, getProfile)
router.put('/profile', protect, updateProfile)
router.put('/change-password', protect, changePassword)
router.post('/avatar', protect, upload.single('avatar'), uploadAvatar)

module.exports = router
