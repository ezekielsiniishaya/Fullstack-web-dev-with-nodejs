const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const fs = require("fs");

const app = express();
const PORT = 5000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public"))); // Serve static assets (CSS, JS, images)

// Session management
app.use(
  session({
    secret: "Iamsaved.", // Change to a strong secret key
    resave: false,
    saveUninitialized: false, // Better to set to false
    cookie: {
      secure: false, // Set to true if using HTTPS
      maxAge: 60 * 60 * 1000, // 1 hour in milliseconds
    },
  })
);

// Middleware to renew session on activity
app.use((req, res, next) => {
  if (req.session) {
    req.session._garbage = Date();
    req.session.touch();
  }
  next();
});

// In-memory storage (can use JSON files for persistence)
let users = [];
let expenses = [];

// Helper functions to read/write data to a JSON file
const writeDataToFile = (filename, content) => {
  fs.writeFileSync(filename, JSON.stringify(content, null, 2), "utf8");
};

const readDataFromFile = (filename) => {
  try {
    return JSON.parse(fs.readFileSync(filename, "utf8") || "[]");
  } catch (error) {
    console.error(`Error reading ${filename}:`, error);
    return [];
  }
};

// Load data from files (for persistence)
if (fs.existsSync("users.json")) {
  users = readDataFromFile("users.json");
}
if (fs.existsSync("expenses.json")) {
  expenses = readDataFromFile("expenses.json");
}

// Helper function to get an expense by ID
const getExpenseById = (expenseId) => {
  return expenses.find((expense) => expense.id === parseInt(expenseId));
};

// Helper function to validate date
function validateDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();

  return (
    date.toString() !== "Invalid Date" &&
    date <= new Date(now.getFullYear() + 100, 11, 31)
  );
}

// Routes

// Serve the home page (index.html)
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
    return res.status(400).json({ message: "User already exists" });
  }

  // Hash the password and store the user
  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) {
      console.error("Error hashing password:", err.message);
      return res.status(500).json({ message: "Error registering user" });
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

    // Redirect to the login page after successful registration
    res.status(200).json({ message: "Registration successful." });
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
    return res.status(400).json({ message: "Invalid email or password" });
  }

  bcrypt.compare(password, user.password, (err, isMatch) => {
    if (err || !isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Store user information in session
    req.session.userId = user.id;
    req.session.userName = user.name;

    // Redirect to the expenses page
    res.status(200).json({ message: "Login successful." });
  });
});

// Serve the expense-related pages
app.get("/add_expense", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "add_expense.html"));
});

app.get("/edit_expense/:id", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "edit_expense.html"));
});

app.get("/view_expense", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "view_expense.html"));
});

// Add Expense Route
app.post("/add-expense", (req, res) => {
  const { date, amount, description } = req.body;

  // Check if user is authenticated
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Validate input
  if (!date || !amount || !description) {
    return res.status(400).json({ message: "All fields are required." });
  }

  if (description.length > 100) {
    return res
      .status(400)
      .json({ message: "Description must be 100 characters or less." });
  }

  const descriptionPattern = /^[a-zA-Z0-9\s]+$/;
  if (!descriptionPattern.test(description)) {
    return res.status(400).json({
      message: "Description can only contain letters, numbers, and spaces.",
    });
  }

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

  res.status(200).json({ message: "Expense added successfully" });
});

// Get Expenses Route
app.get("/expenses", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const userExpenses = expenses.filter(
    (expense) => expense.userId === req.session.userId
  );
  res.status(200).json(userExpenses);
});
// API route to fetch the expense data and display on edit expense page
app.get("/api/edit_expense/:id", async (req, res) => {
  const expenseId = req.params.id;
  try {
    // Replace with your own function to get an expense by ID
    const expense = await getExpenseById(expenseId);

    if (!expense) {
      // If no expense is found, return a 404 error with JSON
      return res
        .status(404)
        .json({ success: false, message: "Expense not found" });
    }

    res.json({ success: true, expense }); // Send the expense data as JSON
  } catch (error) {
    console.error("Error fetching expense:", error);
    // Return a JSON object on error
    res.status(500).json({ success: false, message: "Error fetching expense" });
  }
});

// API route to fetch the expense data
app.get("/api/expenses/:id", (req, res) => {
  const expenseId = req.params.id;

  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const expense = expenses.find(
    (exp) => exp.id === parseInt(expenseId) && exp.userId === req.session.userId
  );

  if (!expense) {
    return res.status(404).json({ message: "Expense not found" });
  }

  res.status(200).json(expense);
});

// Edit Expense Route
app.put("/edit-expense/:id", (req, res) => {
  const expenseId = parseInt(req.params.id, 10);
  const { date, amount, description } = req.body;

  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (!date || !amount || !description) {
    return res.status(400).json({ message: "All fields are required." });
  }

  const expense = expenses.find(
    (exp) => exp.id === expenseId && exp.userId === req.session.userId
  );

  if (!expense) {
    return res.status(404).json({ message: "Expense not found" });
  }

  // Update the expense object
  expense.date = date;
  expense.amount = amount;
  expense.description = description;

  // Save the updated expenses back to the JSON file
  writeDataToFile("expenses.json", expenses);
  res.status(200).json({ message: "Expense updated successfully" });
});

// Delete Expense Route
app.delete("/delete-expense/:id", (req, res) => {
  const expenseId = parseInt(req.params.id);

  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const expenseIndex = expenses.findIndex(
    (exp) => exp.id === expenseId && exp.userId === req.session.userId
  );

  if (expenseIndex === -1) {
    return res.status(404).json({ message: "Expense not found" });
  }

  expenses.splice(expenseIndex, 1);
  writeDataToFile("expenses.json", expenses);

  res.status(200).json({ message: "Expense deleted successfully" });
});

// Get total expenses for the user
app.get("/api/expense", (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const userExpenses = expenses.filter(
    (exp) => exp.userId === req.session.userId
  );
  const totalExpense = userExpenses.reduce(
    (acc, expense) => acc + parseFloat(expense.amount),
    0
  );

  res.status(200).json({ totalExpense });
});

// User Logout Route
app.get("/logout", (req, res) => {
  // Destroy the session
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: "Error logging out" });
    }

    // Check if the request expects JSON (based on the Accept header)
    const acceptsJSON =
      req.headers.accept || req.headers.accept.includes("application/json");

    if (acceptsJSON) {
      // Send JSON response for API requests
      return res.status(200).json({ message: "Logout successful" });
    } else {
      // Redirect to the login page for regular browser requests
      return res.redirect("/login");
    }
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
