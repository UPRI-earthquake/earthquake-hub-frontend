import React, { useState, useEffect, useRef } from "react";
import axios from 'axios';
import styles from "./Form.module.css";
import Toast from "./Toast";

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

function SignInForm( {onClick, onSuccess} ) {
  const backend_host = process.env.NODE_ENV === 'production'
                       ? window['ENV'].REACT_APP_BACKEND
                       : window['ENV'].REACT_APP_BACKEND_DEV

  // TOASTS
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('error');

  async function handleSignInSubmit(event) {
    const username = event.target.elements.username.value;
    const password = event.target.elements.password.value;
    try {
      axios.defaults.withCredentials = true;
      const response = await axios.post(
        `${backend_host}/accounts/authenticate`,
        {
          username: username,
          password: password,
          role: 'citizen'
        }
      );
      console.log("Sign in successful!", response.data);
      onSuccess();
    } catch (error) {
        if (error.response) {
          const { data } = error.response;
          setToastMessage(data.message);
          setToastType('error');
          console.error("Error occurred while signing in:", data);
        } else {
          console.error("Error occurred while signing in:", error);
        }
    }
  }

  return (
    <Form title="Sign In" onClick={onClick} onSuccess={onSuccess} onSubmit={handleSignInSubmit}>
      <Toast message={toastMessage} toastType={toastType}></Toast>
      <label>
        Username
        <input type="text" name="username"/>
      </label>
      <label>
        Password
        <input type="password" name="password"/>
      </label>
      <button type="submit">Sign in</button>
    </Form>
  );
}

function SignUpForm( {onClick, onSuccess} ) {
  const backend_host = process.env.NODE_ENV === 'production'
                       ? window['ENV'].REACT_APP_BACKEND
                       : window['ENV'].REACT_APP_BACKEND_DEV

  // TOASTS
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('error');

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

      // TODO: Pass message of successful login to <Dashboard>
      onSuccess();
    } catch (error) {
      if (error.response) {
        const { data } = error.response;
        setToastMessage(data.message);
        setToastType('error');
        console.error("Error occurred while signing up:", data);
      } else {
        console.error("Error occurred while signing up:", error);
      }
    }
  }

  return (
    <Form title="Sign Up" onClick={onClick} onSuccess={onSuccess} onSubmit={handleSignUpSubmit}>
      <Toast message={toastMessage} toastType={toastType}></Toast>
      <label>
        Email
        <input type="text" name="email" />
      </label>
      <label>
        Username
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
      <button type="submit">Sign Up</button>
    </Form>
  );
}

export { SignInForm, SignUpForm };
