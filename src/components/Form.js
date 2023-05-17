import React, { useState, useEffect, useRef } from "react";
import axios from 'axios';
import styles from "./Form.module.css";
import ErrorPopup from "./ErrorPopup";

function Form({ children, title, onClick, onSubmit }) {
  const formRef = useRef(null);

  useEffect(() => {
    const formEl = formRef.current;
    formEl.classList.remove(styles.hidden);
    formEl.animate(
      [
        { opacity: 0, transform: 'scale(0.7)' },
        { opacity: 1, transform: 'scale(1)' }
      ],
      {
        duration: 150,
        easing: 'cubic-bezier(0, 0, 0.5, 1)'
      }
    );
  }, []);

  const handleSubmit = (event) => {
    // call onSubmit instead of prevent form-submit behavior of sending
    // a basic request to the server to handle the data, making the server
    // navigate to a new page
    event.preventDefault();
    onSubmit(event);
  };

  return (
    <div className={styles.modal} onClick={onClick}>
      {/*When .form div is clicked, prevent click event from bubbling up
         to the div above so that it will not exec it's onClick handler (which
         should close the modal*/}
      <div ref={formRef} className={`${styles.form} ${styles.hidden}`} onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <h2>{title}</h2>
          {children}
        </form>
      </div>
    </div>
  );
}

function SignInForm( {onClick} ) {
  const backend_host = process.env.NODE_ENV === 'production'
                       ? process.env.REACT_APP_BACKEND
                       : process.env.REACT_APP_BACKEND_DEV

  const [errorMessage, setErrorMessage] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false); 

  async function handleSignInSubmit(event) {
    const username = event.target.elements.username.value;
    const password = event.target.elements.password.value;
    try {
      const response = await axios.post(
        `${backend_host}/accounts/authenticate`,
        {
          username: username,
          password: password,
          role: 'citizen'
        }
      );
      console.log("Sign in successful!", response.data);
      setIsLoggedIn(true); // Set isLoggedIn to true upon successful login
    } catch (error) {
        if (error.response) {
          const { data } = error.response;
          setErrorMessage(data.message); // API should always sends {message: ""} in json
          console.error("Error occurred while signing in:", data);
        } else {
          console.error("Error occurred while signing in:", error);
        }
    }
  }

  if (isLoggedIn) { // Render Dashboard
    return (
      <Dashboard></Dashboard>
    );
  }

  return (
    <Form title="Sign In" onClick={onClick} onSubmit={handleSignInSubmit}>
      <label>
        Username
        <input type="text" name="username"/>
      </label>
      <label>
        Password
        <input type="password" name="password"/>
      </label>
      {(errorMessage.length > 0) && <ErrorPopup message={errorMessage} />}
      <button type="submit">Sign in</button>
    </Form>
  );
}

function SignUpForm( {onClick} ) {
  const backend_host = process.env.NODE_ENV === 'production'
                       ? process.env.REACT_APP_BACKEND
                       : process.env.REACT_APP_BACKEND_DEV

  const [errorMessage, setErrorMessage] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false); 

  async function handleSignUpSubmit(event) {
    const email = event.target.elements.email.value;
    const username = event.target.elements.username.value;
    const password = event.target.elements.password.value;
    const confirmPassword = event.target.elements.confirmPassword.value;
    try {
      const response = await axios.post(
        `${backend_host}/accounts/register`,
        {
          email: email,
          username: username,
          password: password,
          confirmPassword: confirmPassword
        }
      );
      console.log("Sign up successful!", response);
      setIsLoggedIn(true); // Set isLoggedIn to true upon successful sign up
    } catch (error) {
      if (error.response) {
        const { data } = error.response;
        setErrorMessage(data.message);
        console.error("Error occurred while signing up:", data);
      } else {
        console.error("Error occurred while signing up:", error);
      }
    }
  }

  if (isLoggedIn) { // Render Dashboard
    return (
      <Dashboard></Dashboard>
    );
  }

  return (
    <Form title="Sign Up" onClick={onClick} onSubmit={handleSignUpSubmit}>
      <label>
        Email
        <input type="text" name="email" />
      </label>
      <label>
        UsernameonClick
        <input type="text" name="username"/>
      </label>
      <label>
        Password
        <input type="password" name="password"/>
      </label>
      <label>
        Confirm Password
        <input type="password" name="confirmPassword"/>
      </label>
      {(errorMessage.length > 0) && <ErrorPopup message={errorMessage} />}
      <button type="submit">Sign Up</button>
    </Form>
  );
}

// --------------------------------------------------------------------------------

function DashboardModal({ children, title, onClick, onSubmit }) {
  const profileRef = useRef(null);

  useEffect(() => {
    const profileEl = profileRef.current;
    profileEl.classList.remove(styles.hidden);
    profileEl.animate(
      [
        { opacity: 0, transform: 'translateX(100%)' }, // Updated transform property
        { opacity: 1, transform: 'translateX(0)' } // Updated transform property
      ],
      {
        duration: 150,
        easing: 'cubic-bezier(0, 0, 0.5, 1)'
      }
    );
  }, []);

  const handleSubmit = (event) => {
    // call onSubmit instead of prevent form-submit behavior of sending
    // a basic request to the server to handle the data, making the server
    // navigate to a new page
    event.preventDefault();
    onSubmit(event);
  };

  return (
    <div className={styles.profileModal} onClick={onClick}>
      {/*When .form div is clicked, prevent click event from bubbling up
         to the div above so that it will not exec it's onClick handler (which
         should close the modal*/}
      <div ref={profileRef} className={`${styles.profileForm} ${styles.hidden}`} onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <h2>{title}</h2>
          {children}
        </form>
      </div>
    </div>
  );
}


function Dashboard() {
  

  return (
    <DashboardModal title="Dashboard">

    </DashboardModal>
  );
}

export { SignInForm, SignUpForm };