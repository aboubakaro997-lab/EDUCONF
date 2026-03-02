import React from 'react';

const Card = ({ 
  children, 
  className = '', 
  hover = false,
  padding = 'md'
}) => {
  const paddingSizes = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
  };

  const hoverClass = hover ? 'hover:shadow-xl transform hover:scale-105 transition duration-300' : '';

  return (
    <div className={`bg-white rounded-lg shadow-md ${paddingSizes[padding]} ${hoverClass} ${className}`}>
      {children}
    </div>
  );
};

export default Card;
