import React, { useState, useEffect, useRef } from "react";
import axios from 'axios';
import styles from "./Form.module.css";
import Toast from "./Toast";
import {responseCodes} from "../responseCodes";

function Form({ children, title, onClick, onSubmit }) {
  const formRef = useRef(null);

  useEffect(() => { // animation to appear from nothing
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
  const [selectedRole, setSelectedRole] = useState('');

  const handleRoleChange = (event) => {
    setSelectedRole(event.target.value);
  };

  async function handleSignInSubmit(event) {
    const username = event.target.elements.username.value;
    const password = event.target.elements.password.value;
    const role = event.target.elements.role.value
    try {
      axios.defaults.withCredentials = true;
      const response = await axios.post(
        `${backend_host}/accounts/authenticate`,
        {
          username: username,
          password: password,
          role: role
        }
      );

      if(response.data.status === responseCodes.AUTHENTICATION_TOKEN_COOKIE){
        console.log("Sign in successful!");
        onSuccess(username, role);
      }
      else {
        console.log("Something went wrong in submitting sign-in request")
      }

    } catch (error) {
        if (error.response) {
          const { data } = error.response;
          setToastMessage(data.message);
          setToastType('error');
          process.env.NODE_ENV !== 'production' &&  
            console.error("Error occurred while signing in:", data);
        } else {
          process.env.NODE_ENV !== 'production' &&  
            console.error("Error occurred while signing in:", error);
        }
    }
  }

  return (
    <Form title="Sign In" onClick={onClick} onSubmit={handleSignInSubmit}>
      <Toast message={toastMessage} toastType={toastType}></Toast>
      <label>
        Username
        <input type="text" name="username"/>
      </label>
      <label>
        Password
        <input type="password" name="password"/>
      </label>
      <label>
        Role
        <select name="role" value={selectedRole} onChange={handleRoleChange}>
          <option value="citizen">Citizen</option>
          <option value="brgy">Brgy</option>
        </select>
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

  const [selectedRole, setSelectedRole] = useState('');

  const handleRoleChange = (event) => {
    setSelectedRole(event.target.value);
  };

  async function handleSignUpSubmit(event) {
    const role = event.target.elements.role.value;
    const email = event.target.elements.email.value;
    const username = event.target.elements.username.value;
    const password = event.target.elements.password.value;
    const confirmPassword = event.target.elements.confirmPassword.value;
    try {
      let requestPayload = {
        role: role,
        email: email,
        username: username,
        password: password,
        confirmPassword: confirmPassword
      }

      if (role === 'brgy') {
        // ringserverUrl format = url:port
        const ringserverUrl = event.target.elements.ringserverUrl.value;
        const ringserverPort = event.target.elements.ringserverPort.value;
        requestPayload.ringserverUrl = ringserverUrl;
        requestPayload.ringserverPort = ringserverPort;
      }

      const response = await axios.post(
        `${backend_host}/accounts/register`, 
        requestPayload
      );
      if(response.data.status === responseCodes.REGISTRATION_SUCCESS){
        console.log("Sign up successful!");
        onSuccess();
      }
      else {
        console.log("Something went wrong in submitting sign-up request")
      }
    } catch (error) {
      if (error.response) {
        const { data } = error.response;
        setToastMessage(data.message);
        setToastType('error');
        process.env.NODE_ENV !== 'production' &&  
         console.error("Error occurred while signing up:", data);
      } else {
        process.env.NODE_ENV !== 'production' &&  
          console.error("Error occurred while signing up:", error);
      }
    }
  }

  return (
    <Form title="Sign Up" onClick={onClick} onSubmit={handleSignUpSubmit}>
      <Toast message={toastMessage} toastType={toastType}></Toast>
      <label>
        Role
        <select name="role" value={selectedRole} onChange={handleRoleChange}>
          <option value="citizen">Citizen</option>
          <option value="brgy">Brgy</option>
        </select>
      </label>
      {(selectedRole === 'brgy') && 
      <>
        <label>
          Ringserver Url
          <input type="text" name="ringserverUrl"/>
        </label>
        <label>
          Ringserver Port
          <input type="text" name="ringserverPort"/>
        </label>
      </>
      }
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
