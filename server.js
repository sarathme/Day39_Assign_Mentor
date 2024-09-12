// REQUIRING dotenv PACKAGE TO GET ACCESS TO THE VARIABLES OF OUR EXTERNAM .env file.

const dotenv = require("dotenv");
dotenv.config();

const app = require("./app");

// DEFINING A PORT AS PER render.com

const port = process.env.PORT || 3000;

// LISTENING TO THE SERVER REQUESTS TO THE PORT.

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
