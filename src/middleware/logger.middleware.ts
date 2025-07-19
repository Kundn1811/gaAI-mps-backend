import morgan from 'morgan';

const logger = morgan('dev'); // You can customize format: 'combined', 'short', etc.
export default logger;
