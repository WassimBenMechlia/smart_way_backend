const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const UserRepository = require('../repositories/userRepository');

async function update(firstName, lastName, email, password) {
    try {
      // Ensure all required parameters are provided
      if (!firstName || !lastName || !email || !password || !dateBirth || !carNumber || !role) {
        throw new Error('Missing required parameters');
      }
  
      // Hash the password before updating the user
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Call the updateUserByEmail method of UserRepository
      const updatedUser = await UserRepository.updateUserByEmail(email, { firstName, lastName, password: hashedPassword });
      
      // Construct and return the response object
      const responseObject = {
        id: updatedUser.id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        email: updatedUser.email,
        
      };
  
      return responseObject;
    } catch (error) {
      throw new Error('Error updating user: ' + error.message);
    }
  }
  
module.exports = { update };
