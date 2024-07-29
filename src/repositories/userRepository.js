// src/repositories/userRepository.js
const pool = require('../config/database');
const db = require('../config/database');
const User = require('../models/User'); // Import the User class
const bcrypt = require('bcrypt');

class UserRepository {
  

  /* async updateTokens(userId, accessToken, refreshToken) {
    await pool.execute('UPDATE users SET access_token = ?, refresh_token = ? WHERE id = ?', [accessToken, refreshToken, userId]);
  } */


  async createUser(firstName, lastName, email, password, country,pinPut) {
    try {
      const newUser = new User({
        firstName : firstName,
        lastName : lastName,
        email : email,
        password : password,
        country : country,
        pinPut : pinPut
      });
      
      await newUser.save();

      return newUser;
    } catch (error) {
      console.error('Error creating user:', error);
      throw new Error('Error creating user');
    }
  }
/* 
  async updateUser(id, newData) {
    const { firstName, lastName, email, password, dateBirth, carNumber, role } = newData;
  
    const query = `
      UPDATE users 
      SET firstName = ?, lastName = ?, email = ?, 
          password = ?, dateBirth = ?, 
          carNumber = ?, 
          role = ? 
      WHERE 
        id = ?
    `;
  
    // Construct the query parameters array
    const queryParams = [firstName, lastName, email, password, dateBirth, carNumber, role, id];
  
    // Execute the update query
    await db.query(query, queryParams);
  
    // Return the updated user object
    return new User(firstName, lastName, email, password, dateBirth, carNumber, role);
  }
   */
 // Assuming this is inside the UserRepository class
/* async updatePasswordByEmail(email, newPassword) {
  try {
    // Validate arguments
    if (!email || !newPassword) {
      throw new Error('Email and new password are required');
    }

    await pool.execute('UPDATE users SET password = ? WHERE email = ?', [newPassword, email]);

    // Return a success message or indication
    return { success: true };
  } catch (error) {
    console.error('Error updating password:', error);
    throw new Error('Error updating password: ' + error.message);
  }
} */



  
  async updateTokens(userId, accessToken, refreshToken) {
    try {
      // Find the user by userId and update the accessToken and refreshToken
      await User.findByIdAndUpdate(userId, { accessToken, refreshToken });
  
      return { success: true };
    } catch (error) {
      console.error('Error updating tokens:', error);
      throw new Error('Error updating tokens: ' + error.message);
    }
  }


  
}

module.exports = UserRepository;
