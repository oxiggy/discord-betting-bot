import { Client, GatewayIntentBits, PermissionsBitField } from 'discord.js';

const TOKEN = process.env.DISCORD_TOKEN;
const TARGET_ROLE_ID = process.env.TARGET_ROLE_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

let guildMembers = null;
const userBalances = new Map();
const START_BALANCE = 1000;
const betsPlayer1 = new Map();
const betsPlayer2 = new Map();
let matchPlayer1 = null;
let matchPlayer2 = null;
let matchTimer = null;

function resetMatch() {
  matchPlayer1 = null;
  matchPlayer2 = null;
  betsPlayer1.clear();
  betsPlayer2.clear();
  matchTimer = null;
  console.log("🔄 Данные матча сброшены.");
}

client.once('ready', () => {
  console.log(`✅ Бот ${client.user.tag} запущен!`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.content.toLowerCase() === "!старт") {
    guildMembers = await message.guild.members.fetch();
    const helpMessage = "**Команды:**\n" +
      "`!крабинициализация`- выдача стартовых коинов \n" +
      "`!клешнеучёт` - общий баланс раков\n" +
      "`!улов` - личный баланс рака\n" +
      "`!матч никнейм1 никнейм2` - запуск битвы\n" +
      "`!ставка никнейм число` - ваши коины во имя рака\n" +
      "`!победа никнейм` - властелин клешней\n" +
      "`!клешнесброс` - отменить битву\n" +
      "`!занавес`\n";
    await message.channel.send(helpMessage);
  }

  if (message.content.toLowerCase().startsWith("!матч")) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("❌ Позовите рака-админа!");
    }
    const args = message.content.split(" ").slice(1);
    if (args.length < 2) {
      return message.channel.send("⚠️ Не хватает бойцов! Укажите двух достойных крабо-воинов. Пример: `!матч никнейм1 никнейм2` 🦀🦀");
    }
    if (matchPlayer1 || matchPlayer2) {
      return message.channel.send("❌ Арена занята! Два краба выясняют, чей панцирь крепче. 🏟️");
    }
    matchPlayer1 = args[0].trim();
    matchPlayer2 = args[1].trim();
    betsPlayer1.clear();
    betsPlayer2.clear();
    await message.channel.send(`🎮 Крабодрака начинается! В углу песчаного ринга – ${matchPlayer1}, в другом – ${matchPlayer2}! Делайте ставки в течение 1 минуты!`);
    matchTimer = setTimeout(() => {
      if (!matchTimer) return; // Если таймер был сброшен, не выполняем код дальше
      const player1Bettors = Array.from(betsPlayer1.keys()).map(userId => `<@${userId}>`).join(", ") || "Никто не рискнул поставить свои Краб Коины… Крабы в шоке! 🦀💔";
      const player2Bettors = Array.from(betsPlayer2.keys()).map(userId => `<@${userId}>`).join(", ") || "Никто не рискнул поставить свои Краб Коины… Крабы в шоке! 🦀💔";
      message.channel.send(
        `⏳ Клешни сжаты, ставки приняты! Битва скоро начнётся! 🔥\n\n` +
        `🦀 На **${matchPlayer1}** поставили свои Краб Коины: ${player1Bettors}\n` +
        `🦀 На **${matchPlayer2}** поставили свои Краб Коины: ${player2Bettors}`
      );
      matchTimer = null;
    }, 60000); // 1 минуты
  }

  if (message.content.toLowerCase().startsWith("!ставка")) {
    if (!matchTimer) {
      return message.reply("❌ Всё! Клешни схлопнулись, ставки зафиксированы! Готовимся к битве! ⚔️");
    }
    const args = message.content.split(" ").slice(1);
    if (args.length < 2) {
      return message.reply("❌ Крабо-фейл! Даже раки знают, что надо ставить правильно: `!ставка никнейм число`");
    }
    const targetPlayer = args[0].trim();
    const amount = parseInt(args[1].trim(), 10);
    const userId = message.author.id;
    if (![matchPlayer1, matchPlayer2].includes(targetPlayer)) {
      return message.reply("❌ Клешнезапрет! Этот краб не участвует в бою. Выберите активного игрока! ⚔️");
    }
    if (isNaN(amount)) {
      return message.reply("❌ Крабо-сбой! Панцирный банк принимает только числа, а не заклинания. Попробуйте ещё раз!");
    }
    if (amount <= 0) {
      return message.reply("❌ Ошибка! Крабы не умеют делать ставки в долг. Введите положительное число!");
    }
    const userBalance = userBalances.get(userId) || 0;
    if (amount > userBalance) {
      return message.reply("❌ Клешни пусты! У вас не хватает токенов для ставки.");
    }
    if (targetPlayer === matchPlayer1) {
      if (betsPlayer2.has(userId)) {
        return message.reply("❌ Клешне-дилемма! Вы уже сделали ставку, панцирь не терпит предательства!");
      }
      betsPlayer1.set(userId, amount);
    } else {
      if (betsPlayer1.has(userId)) {
        return message.reply("❌ Клешне-дилемма! Вы уже сделали ставку, панцирь не терпит предательства!");
      }
      betsPlayer2.set(userId, amount);
    }
    userBalances.set(userId, userBalance - amount);
    const member = await message.guild.members.fetch(userId);
    if (!member.roles.cache.has(TARGET_ROLE_ID)) {
      await member.roles.add(TARGET_ROLE_ID);
    }
    console.log(`Ставка от ${userId} на ${targetPlayer} в количестве ${amount} принята.`);
    await message.react("✅");
  }

  if (message.content.toLowerCase().startsWith("!победа")) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("📢 Позовите рака-админа! Только он может завершить этот эпический бой. ");
    }
    const args = message.content.split(" ").slice(1);
    console.log(args);
    console.log(matchPlayer1, matchPlayer2 );
    const winner = args[0].trim();
    if (!matchPlayer1 || !matchPlayer2 || ![matchPlayer1.toLowerCase(), matchPlayer2.toLowerCase()].includes(winner.toLowerCase())) {
      return message.reply("❌ Ошибка! Напишите никнейм победителя верно.");
    }
    const winningBets = winner === matchPlayer1 ? betsPlayer1 : betsPlayer2;
    winningBets.forEach((amount, userId) => {
      userBalances.set(userId, (userBalances.get(userId) || 0) + amount * 2);
    });
    await message.channel.send(`Победил **${winner}**! Клешни вверх, ставки удвоены!`);
    resetMatch();
  }

  if (message.content.toLowerCase().startsWith("!клешнесброс")) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("📢 Позовите рака-админа!");
    }
    betsPlayer1.forEach((amount, userId) => {
      userBalances.set(userId, (userBalances.get(userId) || 0) + amount);
    });
    betsPlayer2.forEach((amount, userId) => {
      userBalances.set(userId, (userBalances.get(userId) || 0) + amount);
    });
    await message.channel.send("⛔ Арена закрыта! Все ставки отправлены обратно в ваши клешни. 🤲");
    resetMatch();
  }

  if (message.content.toLowerCase() === "!крабинициализация") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("📢 Позовите рака-админа!");
    }
    try {
      console.log(` Загружаем участников сервера '${message.guild.name}'...`);
      const members = await message.guild.members.fetch();
      console.log(`Успешно загружено ${members.size} участников.`);

      members.each((member) => {
        if (!member.user.bot) {
          userBalances.set(member.user.id, START_BALANCE);
        }
      })
      console.log(`Баланс пользователей на сервере '${message.guild.name}' установлен!`);
      //console.log("Список пользователей и их баланс:");
      //userBalances.forEach((balance, userId) => {
      //  console.log(`${userId}: ${balance}`);
      //});
      await message.channel.send("Крабинициализация выполнена! Теперь у каждого есть стартовый запас Краб Коинов! 🦀💰");
    } catch (error) {
      console.error("Ошибка при установке баланса:", error);
      await message.channel.send("⚠️ Крабинициализация прервана! Некоторые крабы застряли в песке и не загрузились. 🦀⏳");
    }
  }

  if (message.content.toLowerCase() === "!клешнеучёт") {
    try {
      console.log(`Фильтруем участников с ролью ID ${TARGET_ROLE_ID}...`);
      const members = await message.guild.members.fetch();
      const filteredMembers = members.filter(member => member.roles.cache.has(TARGET_ROLE_ID));
      if (filteredMembers.size === 0) {
        return message.channel.send("❌ Рачел ещё нет!");
      }
      let balanceMessage = "🏟️ **Крабкапитал:**\n";
      filteredMembers.each(member => {
        const balance = userBalances.get(member.user.id) || 0;
        balanceMessage += `🦀 ${member.user.username}: ${balance} Crab Coins\n`;
      });
      console.log("Балансы отправлены в чат.");
      await message.channel.send(balanceMessage);
    } catch (error) {
      console.error("Ошибка при выводе балансов:", error);
      await message.channel.send("⚠️ Клешня застряла в базе данных! Не удалось достать список счетов.");
    }
  }

  if (message.content.toLowerCase().startsWith("!улов")) {
    const userId = message.author.id;
    const balance = userBalances.get(userId) || 0;
    await message.reply(`💰 У вас на счету ${balance} Краб Коинов! Будете делать ставку или копить на крабовый особняк? 🦞`);
  }

  if (message.content.toLowerCase().startsWith("!установи")) {
    const args = message.content.split(" ").slice(1);
    if (args.length < 2) {
      return message.reply("❌ Ошибка! Формат команды: `!установи id число`");
    }
    const targetId = args[0];
    const amount = parseInt(args[1], 10);
    if (isNaN(amount) || amount < 0) {
      return message.reply("❌ Ошибка! Сумма должна быть положительным числом.");
    }
    userBalances.set(targetId, amount);
    await message.reply(`✅ Клешнеучёт обновлён! Баланс пользователя ${targetId} теперь ${amount} Краб Коинов.`);
  }

  if (message.content.toLowerCase().startsWith("!занавес")) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("❌ Клешни слишком слабы! У вас нет прав для использования этой команды.");
    }
    try {
      const members = await message.guild.members.fetch();
      const filteredMembers = members.filter(member => member.roles.cache.has(TARGET_ROLE_ID));
      let balanceMessage = "**Список балансов:**\n";
      for (const member of filteredMembers.values()) {
        const balance = userBalances.get(member.user.id) || 0;
        balanceMessage += `!установи ${member.user.id} ${balance}\n`;
        await member.roles.remove(TARGET_ROLE_ID);
      }
      await message.author.send(balanceMessage);
      await message.reply("✅ Личное сообщение с балансами отправлено администратору. Все роли удалены.");
    } catch (error) {
      console.error("Ошибка при отправке балансов:", error);
      await message.reply("⚠️ Ошибка при получении списка пользователей.");
    }
    resetMatch();
  }
});


client.login(TOKEN);