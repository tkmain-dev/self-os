import express from 'express';
import cors from 'cors';
import todosRouter from './routes/todos.js';
import diaryRouter from './routes/diary.js';
import scheduleRouter from './routes/schedule.js';
import habitsRouter from './routes/habits.js';
import goalsRouter from './routes/goals.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.use('/api/todos', todosRouter);
app.use('/api/diary', diaryRouter);
app.use('/api/schedules', scheduleRouter);
app.use('/api/habits', habitsRouter);
app.use('/api/goals', goalsRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
