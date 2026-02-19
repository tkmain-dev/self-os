import express from 'express';
import cors from 'cors';
import todosRouter from './routes/todos';
import diaryRouter from './routes/diary';
import scheduleRouter from './routes/schedule';
import habitsRouter from './routes/habits';
import goalsRouter from './routes/goals';
import featureRequestsRouter from './routes/featureRequests';
import wishItemsRouter from './routes/wishItems';
import monthlyGoalsRouter from './routes/monthlyGoals';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.use('/api/todos', todosRouter);
app.use('/api/diary', diaryRouter);
app.use('/api/schedules', scheduleRouter);
app.use('/api/habits', habitsRouter);
app.use('/api/goals', goalsRouter);
app.use('/api/feature-requests', featureRequestsRouter);
app.use('/api/wish-items', wishItemsRouter);
app.use('/api/monthly-goals', monthlyGoalsRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
