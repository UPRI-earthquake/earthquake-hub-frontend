import React from "react";
import styles from "./Form.module.css";

function Form({ title, children, onClick }) {
  return (
    <div className={styles.modal} onClick={onClick}>
      {/*When .form div is clicked, prevent click event from bubbling up
         to the div above so that it will not exec it's onClick handler (which
         should close the modal*/}
      <div className={styles.form} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

function SignInForm( {onClick} ) {
  return (
    <Form title="Sign In" onClick={onClick}>
      <form>
        <label>
          Username
          <input type="text" />
        </label>
        <label>
          Password
          <input type="password" />
        </label>
        <button type="submit">Sign in</button>
      </form>
    </Form>
  );
}

function SignUpForm( {onClick} ) {
  return (
    <Form title="Sign Up" onClick={onClick}>
      <form>
        <label>
          Username:
          <input type="text" />
        </label>
        <label>
          Email:
          <input type="text" />
        </label>
        <label>
          Password:
          <input type="password" />
        </label>
        <label>
          Confirm Password:
          <input type="password" />
        </label>
        <button type="submit">Sign Up</button>
      </form>
    </Form>
  );
}

export { SignInForm, SignUpForm };
