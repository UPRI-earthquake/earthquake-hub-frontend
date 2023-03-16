import React from 'react';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Password } from 'primereact/password';
import Card from '../../common/components/CardComponent/CardComponent';

import useForm from '../../common/utils/hooks/useForm';
import { FORM_FIELDS } from './constant';
import './LoginPage.scss';

const LoginPage = () => {
  const { formInputs, handleFormSubmit, handleInputChange } = useForm(FORM_FIELDS);

  const onSubmit = (e) => {
    handleFormSubmit(e);
  };

  return (
    <div className='login-page'>
      <Card cardTitle='Login'>
        <form onSubmit={onSubmit}>
          <div className='login-page__form'>
            <label htmlFor="username">Username</label>
            <InputText name="username" value={formInputs.username} onChange={handleInputChange} />
            <label htmlFor="password">Password</label>
            <Password name="password" value={formInputs.password} onChange={handleInputChange} feedback={false} />
            <Button label="Login" />
          </div>
        </form>
      </Card>
    </div>
  )
};

export default LoginPage;