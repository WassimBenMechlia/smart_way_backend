const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const UserRepository = require('../repositories/userRepository');

async function login({ email, password }) {
  try {
    const user = await User.findOne({email : email});

    if (!user) {
      throw new Error('User not found');
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      throw new Error('Invalid password');
    }

    // Generate access token
    
    const accessToken = generateAccessToken(user);
    // Return user details along with the tokens
    return { id: user._id,
      firstName : user.firstName,
      lastName :  user.lastName,
      email :  user.email,
      country :user.country,
      accessToken: accessToken,
     };
  } catch (error) {
    throw new Error('Error logging in: ' + error.message);
  }
}

function generateAccessToken(user) {
  return 'Bearer '+ jwt.sign({ userId: user.id,userFirsName: user.firstName , userLastName : user.lastName,userCountry:user.country, userEmail: user.email },
    process.env.JWT_SECRET,
    {expiresIn:process.env.JWT_EXPIRES_IN}
  );
}

function stripBearerToken(token) {
  return token.replace('Bearer ', '');
}





module.exports = { login, generateAccessToken  };
