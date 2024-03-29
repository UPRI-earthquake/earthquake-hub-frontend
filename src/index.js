import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
import {subscribeUser} from './subscription';

import {createStore} from "redux";
import {Provider} from "react-redux";

const selectedEventReducer = (state=null, action) => {
  switch (action.type) {
    case "SELECT":
      return action.payload;
    case "DESELECT":
      return null;
    default:
      return state;
  }
}
const store = createStore(selectedEventReducer)
console.log('start')

ReactDOM.render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>,
  document.getElementById('root')
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://cra.link/PWA
serviceWorkerRegistration.register();
subscribeUser();

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
