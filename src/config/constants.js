require('dotenv').config();

const MAX_MOVES_TO_COMPARE = process.env.MAX_MOVES_TO_COMPARE || 10; // Default to 10 if not set

module.exports = {
    MAX_MOVES_TO_COMPARE
};