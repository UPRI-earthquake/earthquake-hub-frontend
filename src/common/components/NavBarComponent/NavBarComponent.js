import React from 'react';
import { ReactComponent as Logo } from '../../../assets/upri-logo.svg';
import './NavBarComponent.scss';

const NavBarComponent = ({ headerTitle = '', children }) => {
  return (
    <div className="common-navbar">
      <div className="common-navbar__header">
        <Logo className="common-navbar__header__logo" />
        <h1>{headerTitle}</h1>
      </div>
      <div className="common-navbar__header-right">
        {children}
      </div>
    </div>
  )
};

export default NavBarComponent;