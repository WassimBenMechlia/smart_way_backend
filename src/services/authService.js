const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const UserRepository = require('../repositories/userRepository');
const {login} = require('../useCases/loginUser');
const {updatePassword} = require('../useCases/updatePassword');
class AuthService {
  constructor() {
    this.userRepository = new UserRepository();
  }

  async login(email, password) {
    try {
   
      const result = await login({ email, password });
      return result;

    } catch (error) {
      throw new Error('Error logging in: ' + error.message);
    }
  }
  async updateUser(id, newData) {
    // Add any business logic/validation here if needed
    return await this.userRepository.updateUser(id, newData);
  }


  async register(firstName, lastName, email, password,country,pinPut) {
    try {
      // Check if user with the given email already exists
      const user = await this.userRepository.findByEmail(email);
      
      if (user) {
        // If user exists, throw an error
        throw new Error('User already exists!');
      } else {
        // If user does not exist, proceed with user creation
        const newUser = new User({
          firstName : firstName,
          lastName : lastName,
          email : email,
          password : password,
          country : country,
          pinPut : pinPut
        });
        
        await newUser.save();
       
        // Construct the response object with user details
        const responseObject = {
          id: newUser.id,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          email: newUser.email,
          country: newUser.country,
        };
  
        // Return the response object
        return responseObject;
      }
    } catch (error) {
      // Handle any errors that occur during user creation
      throw new Error('Error creating user: ' + error.message);
    }
  }



 
  async updatePassword(email, password, newPassword) {
    try {
      // Delegate the password update operation to the updatePassword use case
      const result = await updatePassword(email, password, newPassword);
      
      // If the update is successful, return the result
      return result;
    } catch (error) {
      // If an error occurs during the update, throw it
      throw new Error('Error updating password: ' + error.message);
    }
  }
  
  
}

module.exports = AuthService;
