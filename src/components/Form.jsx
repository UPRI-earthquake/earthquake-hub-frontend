import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { backendHost } from '../utils/env';
import styles from './Form.module.css';
import Toast from './Toast';
import { devlog, deverror } from '../utils/devlog';
import { responseCodes } from '../utils/responseCodes';

/**
 * Modal form shell with animated entrance. Wraps specific auth forms.
 */
function Form({ children, title, onClick, onSubmit }) {
  const formRef = useRef(null);

  useEffect(() => {
    // animation to appear from nothing
    const formEl = formRef.current;
    formEl.classList.remove(styles.hidden);
    formEl.animate(
      [
        { opacity: 0, transform: 'scale(0.7)' },
        { opacity: 1, transform: 'scale(1)' },
      ],
      {
        duration: 150,
        easing: 'cubic-bezier(0, 0, 0.5, 1)',
      },
    );
  }, []);

  const handleSubmit = (event) => {
    // call onSubmit instead of prevent form-submit behavior of sending
    // a basic request to the server to handle the data, making the server
    // navigate to a new page
    event.preventDefault();
    onSubmit(event);
  };

  const content = (
    <div className={styles.modal} onClick={onClick}>
      {/*When .form div is clicked, prevent click event from bubbling up
         to the div above so that it will not exec it's onClick handler (which
         should close the modal*/}
      <div
        ref={formRef}
        className={`${styles.form} ${styles.hidden}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <h2>{title}</h2>
          {children}
        </form>
      </div>
    </div>
  );

  // Render the modal at the document body level so it truly overlays the app
  return ReactDOM.createPortal(content, document.body);
}

/**
 * Sign in form. Calls onSuccess(username, role) on successful auth.
 */
function SignInForm({ onClick, onSuccess }) {
  // Use runtime environment config; no hard-coded defaults (expect .env to be set)
  const backend_host = backendHost();

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
    const role = event.target.elements.role.value;
    try {
      axios.defaults.withCredentials = true;
      const response = await axios.post(`${backend_host}/accounts/authenticate`, {
        username: username,
        password: password,
        role: role,
      });

      if (response.data.status === responseCodes.AUTHENTICATION_TOKEN_COOKIE) {
        devlog('Sign in successful!');
        onSuccess(username, role);
      } else {
        devlog('Something went wrong in submitting sign-in request');
      }
    } catch (error) {
      if (error.response) {
        const { data } = error.response;
        setToastMessage(data.message);
        setToastType('error');
        deverror('Error occurred while signing in:', data);
      } else {
        deverror('Error occurred while signing in:', error);
      }
    }
  }

  return (
    <Form title="Sign In" onClick={onClick} onSubmit={handleSignInSubmit}>
      <Toast message={toastMessage} toastType={toastType}></Toast>
      <label htmlFor="signin-username">
        Username
        <input id="signin-username" type="text" name="username" autoComplete="username" />
      </label>
      <label htmlFor="signin-password">
        Password
        <input id="signin-password" type="password" name="password" autoComplete="current-password" />
      </label>
      <label htmlFor="signin-role">
        Role
        <select id="signin-role" name="role" value={selectedRole} onChange={handleRoleChange}>
          <option value="citizen">Citizen</option>
          <option value="brgy">Brgy</option>
        </select>
      </label>
      <button type="submit">Sign in</button>
    </Form>
  );
}

/**
 * Sign up form. Calls onSuccess() after successful registration.
 */
function SignUpForm({ onClick, onSuccess }) {
  // Use runtime environment config; no hard-coded defaults (expect .env to be set)
  const backend_host = backendHost();

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
        confirmPassword: confirmPassword,
      };

      if (role === 'brgy') {
        // ringserverUrl format = url:port
        const ringserverUrl = event.target.elements.ringserverUrl.value;
        const ringserverPort = event.target.elements.ringserverPort.value;
        requestPayload.ringserverUrl = ringserverUrl;
        requestPayload.ringserverPort = ringserverPort;
      }

      const response = await axios.post(`${backend_host}/accounts/register`, requestPayload);
      if (response.data.status === responseCodes.REGISTRATION_SUCCESS) {
        devlog('Sign up successful!');
        onSuccess();
      } else {
        devlog('Something went wrong in submitting sign-up request');
      }
    } catch (error) {
      if (error.response) {
        const { data } = error.response;
        setToastMessage(data.message);
        setToastType('error');
        deverror('Error occurred while signing up:', data);
      } else {
        deverror('Error occurred while signing up:', error);
      }
    }
  }

  return (
    <Form title="Sign Up" onClick={onClick} onSubmit={handleSignUpSubmit}>
      <Toast message={toastMessage} toastType={toastType}></Toast>
      <label htmlFor="signup-role">
        Role
        <select id="signup-role" name="role" value={selectedRole} onChange={handleRoleChange}>
          <option value="citizen">Citizen</option>
          <option value="brgy">Brgy</option>
        </select>
      </label>
      {selectedRole === 'brgy' && (
        <>
          <label htmlFor="signup-ringserver-url">
            Ringserver Url
            <input id="signup-ringserver-url" type="text" name="ringserverUrl" autoComplete="url" />
          </label>
          <label htmlFor="signup-ringserver-port">
            Ringserver Port
            <input id="signup-ringserver-port" type="text" name="ringserverPort" inputMode="numeric" />
          </label>
        </>
      )}
      <label htmlFor="signup-email">
        Email
        <input id="signup-email" type="text" name="email" autoComplete="email" />
      </label>
      <label htmlFor="signup-username">
        Username
        <input id="signup-username" type="text" name="username" autoComplete="username" />
      </label>
      <label htmlFor="signup-password">
        Password
        <input id="signup-password" type="password" name="password" autoComplete="new-password" />
      </label>
      <label htmlFor="signup-password-confirm">
        Confirm Password
        <input id="signup-password-confirm" type="password" name="confirmPassword" autoComplete="new-password" />
      </label>
      <button type="submit">Sign Up</button>
    </Form>
  );
}

export { SignInForm, SignUpForm };
