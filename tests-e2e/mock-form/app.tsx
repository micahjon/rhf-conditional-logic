import React from 'react';
import { Form } from './form';

export function App() {
  // Single centered column
  return (
    <div className="container" style={{ maxWidth: '20rem', marginTop: '4rem' }}>
      <h1>Test Form</h1>
      <Form />
    </div>
  );
}
