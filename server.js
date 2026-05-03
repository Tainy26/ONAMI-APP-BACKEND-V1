require("dotenv").config();
const app = require("./src/app");

const PORT = Number(process.env.PORT) || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`ONAMI Backend running in http://localhost:${PORT}`)
  });
}

module.exports = app;
