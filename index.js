const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.set("view engine", "html");
app.set("views", path.join(__dirname, "views"));

// Session management
app.use(
  session({
    secret: "Iamsaved.", // Change to a strong secret key
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Set to true if using HTTPS
  })
);

// In-memory storage (or you can store it in a JSON file for persistence)
let users = [];
let expenses = [];

// Helper function to read and write data to a JSON file
const writeDataToFile = (filename, content) => {
  fs.writeFileSync(filename, JSON.stringify(content, null, 2), "utf8");
};

const readDataFromFile = (filename) => {
  return JSON.parse(fs.readFileSync(filename, "utf8") || "[]");
};

// Load data from files (if needed for persistence)
if (fs.existsSync("users.json")) {
  users = readDataFromFile("users.json");
}
if (fs.existsSync("expenses.json")) {
  expenses = readDataFromFile("expenses.json");
}

// Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "index.html"));
});

// Serve the registration page
app.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "register.html"));
});

// User Registration Route
app.post("/register", (req, res) => {
  const { name, email, password } = req.body;

  // Check if user already exists
  if (users.find((user) => user.email === email)) {
    return res.status(400).send("User already exists");
  }

  // Hash the password and store the user
  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) {
      console.error("Error hashing password:", err.message);
      return res.status(500).send("Error registering user");
    }

    const newUser = {
      id: users.length + 1,
      name,
      email,
      password: hashedPassword,
    };
    users.push(newUser);

    // Persist the users data
    writeDataToFile("users.json", users);

    // Redirect to login page after successful registration
    res.redirect("/login");
  });
});

// Serve the login page
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "login.html"));
});

// User Login Route
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  const user = users.find((user) => user.email === email);

  if (!user) {
    return res.status(401).send("Invalid email or password");
  }

  bcrypt.compare(password, user.password, (err, isMatch) => {
    if (err || !isMatch) {
      return res.status(401).send("Invalid email or password");
    }

    // Store user information in session
    req.session.userId = user.id;
    req.session.userName = user.name;

    res.redirect("/view_expense.html");
  });
});

// Serve the expense pages
app.get("/add_expense.html", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "add_expense.html"));
});

app.get("/edit_expense.html", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "edit_expense.html"));
});

app.get("/view_expense.html", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "view_expense.html"));
});

// Add Expense Route
app.post("/add-expense", (req, res) => {
  const { date, amount, description } = req.body;

  // Add new expense
  const newExpense = {
    id: expenses.length + 1,
    userId: req.session.userId,
    date,
    amount,
    description,
  };
  expenses.push(newExpense);

  // Persist expenses data
  writeDataToFile("expenses.json", expenses);

  res.redirect("/view_expense.html");
});

// Get Expenses Route
app.get("/expenses", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).send("Unauthorized");
  }

  const userExpenses = expenses.filter(
    (expense) => expense.userId === req.session.userId
  );
  res.status(200).json(userExpenses);
});

// Update Expense Route
app.put("/edit-expense/:id", (req, res) => {
  const expenseId = parseInt(req.params.id);
  const { date, amount, description } = req.body;

  const expense = expenses.find(
    (exp) => exp.id === expenseId && exp.userId === req.session.userId
  );
  if (!expense) {
    return res.status(404).send("Expense not found");
  }

  // Update expense details
  expense.date = date;
  expense.amount = amount;
  expense.description = description;

  // Persist updated expenses data
  writeDataToFile("expenses.json", expenses);

  res.status(200).json({ message: "Expense updated successfully" });
});

// Delete Expense Route
app.delete("/delete-expense/:id", (req, res) => {
  const expenseId = parseInt(req.params.id);

  expenses = expenses.filter(
    (exp) => exp.id !== expenseId || exp.userId !== req.session.userId
  );

  // Persist updated expenses data
  writeDataToFile("expenses.json", expenses);

  res.status(200).json({ message: "Expense deleted successfully" });
});

// Get total expenses for the user
app.get("/api/expense", (req, res) => {
  const userExpenses = expenses.filter(
    (exp) => exp.userId === req.session.userId
  );
  const total = userExpenses.reduce(
    (sum, exp) => sum + parseFloat(exp.amount),
    0
  );

  res.status(200).json({ total });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
