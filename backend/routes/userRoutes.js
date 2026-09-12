const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')
const { allowRoles } = require('../middleware/roleMiddleware')
const { upload } = require('../config/cloudinary')
const { validate } = require('../middleware/validate')
const S = require('../middleware/schemas')
const {
  getAllUsers, setUserRole, getProfile, updateProfile,
  changePassword, uploadAvatar
} = require('../controllers/userController')

router.get('/', protect, allowRoles('admin'), getAllUsers)
router.patch(
  '/:id/role',
  protect,
  allowRoles('admin'),
  validate(S.setRole),
  setUserRole
)

router.get('/profile', protect, getProfile)
router.put('/profile', protect, validate({ body: S.updateProfile }), updateProfile)
router.put(
  '/change-password',
  protect,
  validate({ body: S.changePassword }),
  changePassword
)
router.post('/avatar', protect, upload.single('avatar'), uploadAvatar)

module.exports = router
