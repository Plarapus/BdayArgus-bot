const TelegramBot = require('node-telegram-bot-api');
const moment = require('moment');
const fs = require('fs');
const csv = require('csv-parser');

// Токен вашего бота
const token = '7544574662:AAEqQ0srXWqLpwMIz-kb21JGZZ52z5P6t8k';
const bot = new TelegramBot(token, { polling: true });

// Набор подписчиков
const users = new Set();
// Массив для хранения дат рождений
let birthdays = [];

/**
 * Загружает данные из файла birthdays.csv
 */
function loadBirthdays() {
  birthdays = [];
  fs.createReadStream('birthdays.csv')
    .pipe(csv())
    .on('data', row => {
      // ожидаемый формат: name=Имя, birthday=DD-MM
      if (row.name && row.birthday && /^\d{1,2}-\d{1,2}$/.test(row.birthday)) {
        birthdays.push({ name: row.name.trim(), birthday: row.birthday.trim() });
      }
    })
    .on('end', () => {
      console.log('Список дней рождений загружен:', birthdays.length, 'записей');
    })
    .on('error', err => {
      console.error('Ошибка при чтении CSV:', err);
    });
}

/**
 * Проверяет дни рождения и рассылает напоминания
 */
function checkBirthdays() {
  if (users.size === 0 || birthdays.length === 0) return;

  const today = moment();
  const todayKey = today.format('DD-MM');
  const tomorrowKey = today.clone().add(1, 'day').format('DD-MM');

  users.forEach(chatId => {
    birthdays.forEach(({ name, birthday }) => {
      if (birthday === todayKey) {
        bot.sendMessage(chatId, `🎉 Сегодня день рождения у *${name}*!`, { parse_mode: 'Markdown' });
      } else if (birthday === tomorrowKey) {
        bot.sendMessage(chatId, `🎁 Завтра день рождения у *${name}*!`, { parse_mode: 'Markdown' });
      }
    });
  });
}

/**
 * Планирует ежедневную проверку в 9:00
 */
function scheduleDailyCheck() {
  const now = moment();
  let nextCheck = moment().hour(9).minute(0).second(0);
  if (now.isAfter(nextCheck)) {
    nextCheck.add(1, 'day');
  }

  const delay = nextCheck.diff(now);
  setTimeout(() => {
    checkBirthdays();
    // далее проверка каждые 24 часа
    setInterval(checkBirthdays, 24 * 60 * 60 * 1000);
  }, delay);
}

// Обработчики команд
bot.onText(/\/start/, msg => {
  users.add(msg.chat.id);
  bot.sendMessage(msg.chat.id, 'Привет! Я напомню тебе о днях рождения.', { reply_markup: { remove_keyboard: true } });
});

bot.onText(/\/reload/, msg => {
  if (!users.has(msg.chat.id)) return;
  loadBirthdays();
  bot.sendMessage(msg.chat.id, '✅ Список дней рождений обновлён.');
});

bot.onText(/\/list/, msg => {
  if (!users.has(msg.chat.id)) return;

  const now = moment();
  const upcoming = birthdays
    .map(({ name, birthday }) => {
      const [day, month] = birthday.split('-').map(Number);
      let date = moment({ year: now.year(), month: month - 1, day });
      if (date.isBefore(now, 'day')) date.add(1, 'year');
      return { name, date };
    })
    .filter(({ date }) => date.diff(now, 'days') <= 7)
    .sort((a, b) => a.date.diff(b.date));

  if (upcoming.length === 0) {
    bot.sendMessage(msg.chat.id, 'Нет дней рождений в ближайшие 7 дней.');
  } else {
    const lines = upcoming.map(({ name, date }) => `• ${date.format('DD MMMM')} — ${name}`);
    const text = ['📅 *Ближайшие дни рождения:*', ...lines].join('\n');
    bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
  }
});

// Инициализация
loadBirthdays();
scheduleDailyCheck();

console.log('Бот запущен и готов к работе.');