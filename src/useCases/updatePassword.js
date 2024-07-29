const bcrypt = require('bcrypt');
const UserRepository = require('../repositories/userRepository');

async function updatePassword(email, password, newPassword) {
  const userRepository = new UserRepository();
  try {
    // Ensure all required parameters are provided
    if (!email || !password || !newPassword) {
      throw new Error('Missing required parameters');
    }

    // Retrieve user from the database
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify the current password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    // Hash the new password before updating
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the user's password in the database
    await userRepository.updatePasswordByEmail(email,hashedPassword);

    return { success: true };
  } catch (error) {
    throw new Error('Error updating password: ' + error.message);
  }
}

module.exports = { updatePassword };
