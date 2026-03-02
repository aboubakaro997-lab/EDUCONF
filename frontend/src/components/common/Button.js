import React from 'react';

const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  fullWidth = false,
  disabled = false,
  onClick,
  type = 'button',
  className = '',
  icon = null
}) => {
  const baseClasses = 'font-semibold rounded-lg transition duration-200 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none';
  
  const variants = {
    primary: 'bg-ci-orange hover:bg-ci-orange-dark text-white focus:ring-ci-orange shadow-ci hover:shadow-xl',
    secondary: 'bg-ci-gray-200 hover:bg-ci-gray-300 text-ci-gray-800 focus:ring-ci-gray-400',
    success: 'bg-ci-green hover:bg-ci-green-dark text-white focus:ring-ci-green shadow-ci-green hover:shadow-xl',
    danger: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500 shadow-lg hover:shadow-xl',
    outline: 'border-2 border-ci-orange text-ci-orange hover:bg-ci-orange hover:text-white focus:ring-ci-orange',
    'outline-white': 'border-2 border-white text-white hover:bg-white hover:text-ci-orange focus:ring-white',
    'outline-green': 'border-2 border-ci-green text-ci-green hover:bg-ci-green hover:text-white focus:ring-ci-green',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg',
  };

  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${widthClass} ${className} flex items-center justify-center gap-2`}
    >
      {icon && <span>{icon}</span>}
      {children}
    </button>
  );
};

export default Button;
