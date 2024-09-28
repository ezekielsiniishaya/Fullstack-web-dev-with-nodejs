document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded and parsed");

  // Constants for API endpoints
  const API_BASE_URL = "/";
  const ENDPOINTS = {
    ADD_EXPENSE: `${API_BASE_URL}add-expense`,
    VIEW_EXPENSE: `${API_BASE_URL}view_expense`,
    EXPENSES: `${API_BASE_URL}expenses`,
    DELETE_EXPENSE: (id) => `${API_BASE_URL}delete-expense/${id}`,
    EDIT_EXPENSE: (id) => `${API_BASE_URL}edit_expense/${id}`,
    LOGIN: `${API_BASE_URL}login`,
    REGISTER: `${API_BASE_URL}register`,
  };

  // Show alert function
  function showAlert(message) {
    const alertBox = document.getElementById("alert");
    alertBox.textContent = message;
    alertBox.style.display = "block"; // Show alert
    alertBox.className = "alert"; // Reset alert class

    // Automatically hide the alert after 35 seconds
    setTimeout(() => {
      alertBox.style.display = "none"; // Hide alert
    }, 5000);
  }

  // Function to clear any previous alerts
  function clearAlerts() {
    const alerts = document.querySelectorAll(".alert");
    alerts.forEach((alert) => alert.remove());
  }

  // Function to format date to yyyy-mm-dd
  function formatDateToYYYYMMDD(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear(); // Get year
    const month = String(date.getMonth() + 1).padStart(2, "0"); // Get month (0-indexed) and pad
    const day = String(date.getDate()).padStart(2, "0"); // Get day and pad with leading zero
    return `${year}-${month}-${day}`; // Return formatted date
  }
  function validateDate(dateString) {
    // Regular expression to check if date is in yyyy-mm-dd format
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateString.match(datePattern)) {
      return false; // Invalid format
    }

    const date = new Date(dateString);
    const now = new Date();

    // Check if the date is valid and not too far in the future
    if (
      date.toString() === "Invalid Date" ||
      date > new Date(now.getFullYear() + 100, 11, 31)
    ) {
      return false; // Invalid date or too far in the future
    }

    return true; // Valid date
  }

  // Add Expense Form Submission
  const addExpenseForm = document.getElementById("add-expense-form");
  if (addExpenseForm) {
    addExpenseForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(event.target);

      // Get user input values
      const dateInput = formData.get("date");
      const amountInput = formData.get("amount");
      const descriptionInput = formData.get("description");

      // Convert to yyyy-mm-dd format
      const formattedDate = formatDateToYYYYMMDD(dateInput);
      //validate the date
      const updatedDate = document.getElementById("date").value;
      if (!validateDate(updatedDate)) {
        showAlert(
          "Please enter a valid date in the format YYYY-MM-DD and within a reasonable range."
        );
        return;
      }
      // Validate Amount
      const amountPattern = /^\d+$/; // Allows only positive integers (no decimals)
      let aisValid = true;
      let amountError = "";

      if (!amountPattern.test(amountInput) || parseInt(amount) <= 0) {
        amountError = "Amount must be a positive integer.";
        aisValid = false;
      }

      if (!aisValid) {
        showAlert(amountError);
        return; // Stop form submission if validation fails
      }

      // Frontend Validation
      let isValid = true;
      let descriptionError = ""; // Clear previous errors

      // Validate Description Length
      if (descriptionInput.length > 100) {
        descriptionError = "Description must be 100 characters or less.";
        isValid = false;
      }

      // Validate Description Characters
      const descriptionPattern = /^[a-zA-Z0-9\s]+$/;
      if (!descriptionPattern.test(descriptionInput)) {
        descriptionError =
          "Description can only contain letters, numbers, and spaces.";
        isValid = false;
      }

      if (!isValid) {
        showAlert(descriptionError);
        return; // Stop form submission if validation fails
      }

      // Prepare data to send to the server
      const data = {
        date: formattedDate, // Use the correctly formatted date
        amount: amountInput,
        description: descriptionInput,
      };

      try {
        const response = await fetch(ENDPOINTS.ADD_EXPENSE, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        });

        if (response.ok) {
          showAlert("Expense added successfully!");
          setTimeout(() => {
            window.location.href = ENDPOINTS.VIEW_EXPENSE; // Redirect to view expenses
          }, 2000);
        } else {
          const errorData = await response.json();
          showAlert(errorData.message || "Failed to add expense.");
        }
      } catch (error) {
        console.error("Error adding expense:", error);
        showAlert("An unexpected error occurred.");
      }
    });
  }

  // Fetch and display expenses on the view expense page
  if (document.getElementById("expense-list")) {
    fetch(ENDPOINTS.EXPENSES)
      .then((response) => {
        if (response.status === 401) {
          showAlert("Session expired. Please log in again.");
          setTimeout(() => {
            window.location.href = "/login";
          }, 3000);
          throw new Error("Unauthorized");
        }
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.json();
      })
      .then((expenses) => {
        const expenseList = document.getElementById("expense-list");
        expenses.forEach((expense, index) => {
          const formattedDate = formatDateToYYYYMMDD(expense.date);
          const row = document.createElement("tr");
          row.innerHTML = `
            <td>${index + 1}</td>
            <td>${formattedDate}</td>
            <td>${expense.amount}</td>
            <td>${expense.description}</td>
            <td>
              <button onclick="editExpense(${expense.id})">Edit</button>
              <button onclick="deleteExpense(${expense.id})">Delete</button>
            </td>
          `;
          expenseList.appendChild(row);
        });
      })
      .catch((error) => {
        console.error("Error fetching expenses:", error);
        if (error.message !== "Unauthorized") {
          showAlert("Failed to load expenses.");
        }
      });
  }

  // Function to edit an expense
  window.editExpense = function (id) {
    window.location.href = ENDPOINTS.EDIT_EXPENSE(id); // Redirect to edit page
  };

  // Function to delete an expense
  window.deleteExpense = function (id) {
    fetch(ENDPOINTS.DELETE_EXPENSE(id), {
      method: "DELETE",
    })
      .then((response) => {
        if (response.ok) {
          showAlert("Expense deleted successfully!");
          location.reload(); // Refresh the page to see updated expenses
        } else if (response.status === 401) {
          showAlert("Session expired. Please log in again.");
          setTimeout(() => {
            window.location.href = "/login";
          }, 3000);
        } else {
          return response.json().then((data) => {
            throw new Error(data.message || "Failed to delete expense.");
          });
        }
      })
      .catch((error) => {
        console.error("Error deleting expense:", error);
        showAlert(error.message);
      });
  };
  //Edit expense
  const editExpenseForm = document.getElementById("edit-expense-form");

  if (editExpenseForm) {
    // Get the expense ID from the URL
    const expenseId = window.location.pathname.split("/").pop();
    console.log("Expense ID:", expenseId);

    // Define the function to update expense
    function updateExpense(id) {
      const updatedDescription = document.getElementById("description").value;
      const updatedAmount = document.getElementById("amount").value;
      const updatedDate = document.getElementById("date").value;
      fetch(`/edit_expense/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          description: updatedDescription,
          amount: updatedAmount,
          date: updatedDate,
        }),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("Error updating expense");
          }
          return response.json();
        })
        .then((data) => {
          console.log(data.message);
          // Redirect or update UI here
          window.location.href = "/view_expense";
        })
        .catch((error) => {
          console.error("Error updating expense:", error);
        });
    }

    // Define the function to load the expense data when the page loads
    async function loadExpenseData(expenseId) {
      try {
        const response = await fetch(`/api/edit_expense/${expenseId}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const expense = await response.json();

        // Populate the form with expense data
        document.getElementById("amount").value = expense.expense.amount;
        document.getElementById("description").value =
          expense.expense.description;
        document.getElementById("date").value = expense.expense.date;
      } catch (error) {
        console.error("Error loading expense data:", error);
      }
    }

    // Load expense data on page load
    loadExpenseData(expenseId);

    // Handle form submission
    editExpenseForm.addEventListener("submit", function (e) {
      e.preventDefault(); // Prevent the default form submission

      const date = document.getElementById("date").value;
      const amount = document.getElementById("amount").value;
      const description = document.getElementById("description").value;

      // Validate Date

      if (!validateDate(date)) {
        showAlert(
          "Please enter a valid date in the format YYYY-MM-DD and within a reasonable range."
        );
        return;
      }

      // Validate Amount
      const amountPattern = /^\d+$/; // Allows only positive integers (no decimals)
      let aisValid = true;
      let amountError = "";

      if (!amountPattern.test(amount) || parseInt(amount) <= 0) {
        amountError = "Amount must be a positive integer.";
        aisValid = false;
      }

      if (!aisValid) {
        showAlert(amountError);
        return; // Stop form submission if validation fails
      }

      // Frontend validation
      let isValid = true;
      let descriptionError = ""; // Clear previous errors

      // Validate Description Length
      if (description.length > 100) {
        descriptionError = "Description must be 100 characters or less.";
        isValid = false;
      }

      // Validate Description Characters
      const descriptionPattern = /^[a-zA-Z0-9\s]+$/;
      if (!descriptionPattern.test(description)) {
        descriptionError =
          "Description can only contain letters, numbers, and spaces.";
        isValid = false;
      }

      if (!isValid) {
        showAlert(descriptionError);
        return; // Stop form submission if validation fails
      }

      // Convert date to yyyy-mm-dd format (optional utility function)
      const formattedDate = formatDateToYYYYMMDD(date);

      updateExpense(expenseId); // Call update function with the expense ID
    });
  }
  // Register Form Submission
  const registerForm = document.getElementById("registerForm");

  if (registerForm) {
    registerForm.addEventListener("submit", async (event) => {
      event.preventDefault(); // Prevent the default form submission

      const formData = new FormData(event.target);
      const email = formData.get("email");
      const password = formData.get("password");

      // Basic validation
      if (!email || !password) {
        showAlert("Email and Password are required!");
        return; // Stop form submission if validation fails
      }

      try {
        const response = await fetch(ENDPOINTS.REGISTER, {
          // Correct endpoint
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }), // Send email and password
        });

        if (response.ok) {
          showAlert("Registration successful! Please log in.");
          setTimeout(() => {
            window.location.href = "/login"; // Redirect to login after registration
          }, 2000);
        } else {
          const errorData = await response.json();
          showAlert(errorData.message || "Registration failed.");
        }
      } catch (error) {
        console.error("Error registering:", error);
        showAlert("An unexpected error occurred.");
      }
    });
  }

  // Login Form Submission
  const loginForm = document.getElementById("loginForm");

  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault(); // Prevent the default form submission

      const formData = new FormData(event.target);
      const email = formData.get("email");
      const password = formData.get("password");

      // Basic validation
      if (!email || !password) {
        showAlert("Email and Password are required!");
        return; // Stop form submission if validation fails
      }

      try {
        const response = await fetch(ENDPOINTS.LOGIN, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }), // Send email and password
        });

        if (response.ok) {
          showAlert("Login successful!");
          setTimeout(() => {
            window.location.href = "/view_expense"; // Redirect to view expenses on successful login
          }, 2000);
        } else {
          const errorData = await response.json();
          showAlert(errorData.message || "Login failed.");
        }
      } catch (error) {
        console.error("Error logging in:", error);
        showAlert("An unexpected error occurred.");
      }
    });
  }
});
