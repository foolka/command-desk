const {normalize}=require('./model.cjs');

const copy={
	ru:{
		triggers:['!кусь','!обнять','!кто','!удача','!кубик','!привет','!химия','!тг','!дс','!команды'],
		names:['Кусь с разными ответами','Обнимашки','Кто ты сегодня','Процент удачи','Бросок кубика','Текстовое приветствие','Химия между зрителями','Telegram','Discord','Список команд'],
		bites:['{user} нежно кусает {target}. Это не нападение, это привязанность.','{user} делает кусь {target}. Гарантия на целую самооценку закончилась.','{user} пробует {target} на вкус. Кажется, булочка с характером!','{user} кусает {target} и делает вид, что это был лаг.','{user} оставляет на {target} маленькую отметку: «любимый человек чата».','{user} цапает {target}. Критический урон: минус одна серьёзность.','{user} кусает {target}, потом извиняется обнимашкой.','{user} осторожно делает кусь {target}. Проверка на сладость пройдена.'],
		hugs:['{user} заворачивает {target} в плед. Сопротивление бесполезно: тут уют.','{user} обнимает {target} так крепко, что тревожность вышла из чата.','{user} выдаёт {target} обнимашку без очереди и бюрократии.','{user} обнимает {target}. Сарказм на минуту выключен, нежность включена.'],
		roles:['сертифицированная булочка с тревожной начинкой','директор по важному лежанию','финальный босс неловких пауз','карманный генератор сарказма','рыцарь пледа и последней печеньки','самый милый подозреваемый','легенда, которую пока не загрузили','главный специалист по «я только посмотрю»'],
		who:'{user} сегодня {choice}.',luck:'{user}, запас удачи: {amount}%. Остальное вытянем харизмой.',dice:'{user} выбрасывает {amount} из 6. Кубик утверждает, что он независимый эксперт.',
		greeting:'{user}, привет! Проходи, располагайся. Чай воображаемый, рады тебе по-настоящему.',
		chemistry:['дуэт, которому нельзя доверять печенье','два уютных хаоса в одном чате','союз нежности и подозрительного хихиканья','команда «мы всё контролируем», но это неточно'],
		combined:'{user} и {target}: совместимость {amount}%. Вы — {choice}.',
		tg:'Наш Telegram: добавьте сюда вашу ссылку.',ds:'Наш Discord: добавьте сюда вашу ссылку.',commands:'Доступные команды: {commands}',
		none:'{user}, сейчас некого выбрать. Можно написать ник после команды.',invalid:'{user}, после команды нужен Twitch-ник, например @ViewerTwo.'
	},
	uk:{
		triggers:['!кусь','!обійняти','!хто','!удача','!кубик','!привіт','!хімія','!тг','!дс','!команди'],
		names:['Кусь із різними відповідями','Обійми','Хто ти сьогодні','Відсоток удачі','Кидок кубика','Текстове привітання','Хімія між глядачами','Telegram','Discord','Список команд'],
		bites:['{user} ніжно кусає {target}. Це не напад, це прихильність.','{user} робить кусь {target} і вдає, що це був лаг.','{user} пробує {target} на смак. Булочка з характером!','{user} кусає {target}, а потім вибачається обіймами.','{user} залишає на {target} позначку: «улюблена людина чату».'],
		hugs:['{user} загортає {target} у плед. Опір марний: тут затишок.','{user} обіймає {target} так міцно, що тривожність вийшла з чату.','{user} видає {target} обійми без черги та бюрократії.'],
		roles:['сертифікована булочка з тривожною начинкою','директор із важливого лежання','фінальний бос незручних пауз','кишеньковий генератор сарказму','лицар пледа та останнього печива','наймиліший підозрюваний'],
		who:'{user} сьогодні {choice}.',luck:'{user}, запас удачі: {amount}%. Решту витягнемо харизмою.',dice:'{user} викидає {amount} із 6. Кубик запевняє, що він незалежний експерт.',
		greeting:'{user}, привіт! Влаштовуйся зручніше. Чай уявний, а радість від зустрічі справжня.',
		chemistry:['дует, якому не можна довіряти печиво','два затишні хаоси в одному чаті','союз ніжності й підозрілого хихотіння'],combined:'{user} і {target}: сумісність {amount}%. Ви — {choice}.',
		tg:'Наш Telegram: додайте сюди ваше посилання.',ds:'Наш Discord: додайте сюди ваше посилання.',commands:'Доступні команди: {commands}',
		none:'{user}, зараз немає кого обрати. Можна вказати нік після команди.',invalid:'{user}, після команди потрібен Twitch-нік, наприклад @ViewerTwo.'
	},
	en:{
		triggers:['!bite','!hug','!who','!luck','!dice','!hello','!chemistry','!tg','!ds','!commands'],
		names:['Bites with varied replies','Hugs','Who are you today','Luck percentage','Roll a die','Text greeting','Chatter chemistry','Telegram','Discord','Command list'],
		bites:['{user} gently bites {target}. Not an attack, just affection.','{user} bites {target} and blames the lag.','{user} taste-tests {target}. A cinnamon roll with attitude!','{user} bites {target}, then apologizes with a hug.','{user} tags {target}: certified chat sweetheart.'],
		hugs:['{user} wraps {target} in a blanket. Resistance is futile: this is cozy.','{user} hugs {target} until anxiety leaves the chat.','{user} gives {target} a hug. No queue, no paperwork.'],
		roles:['a certified anxious cinnamon roll','the director of important lounging','the final boss of awkward pauses','a pocket-sized sarcasm generator','the knight of blankets and last cookies','the cutest suspect'],
		who:'{user} is {choice} today.',luck:'{user}, luck level: {amount}%. Charisma will cover the rest.',dice:'{user} rolls {amount} out of 6. The die claims to be an independent expert.',
		greeting:'Hello, {user}! Make yourself comfortable. The tea is imaginary, the welcome is real.',
		chemistry:['a duo that cannot be trusted with cookies','two cozy disasters in one chat','an alliance of affection and suspicious giggling'],combined:'{user} and {target}: {amount}% compatibility. You are {choice}.',
		tg:'Our Telegram: add your link here.',ds:'Our Discord: add your link here.',commands:'Available commands: {commands}',
		none:'{user}, nobody to pick right now. Try adding a username.',invalid:'{user}, add a Twitch username after the command, such as @ViewerTwo.'
	}
};
const keys=['target','hug','choice','number','dice','text','combined','telegram','discord','commands'];

// Examples are independent disabled copies; never replace an existing trigger.
function examples(language='ru'){
	const d=copy[language]||copy.ru,target={type:'target',variable:'target',mode:'argument_or_random'},number={type:'number',variable:'amount',min:0,max:100};
	const bodies=[
		{steps:[target],responses:d.bites,responseMode:'random'},
		{steps:[target],responses:d.hugs,responseMode:'random'},
		{steps:[{type:'choice',variable:'choice',choices:d.roles}],responses:[d.who]},
		{steps:[number],responses:[d.luck]},
		{steps:[{...number,min:1,max:6}],responses:[d.dice]},
		{steps:[{type:'text',variable:'greeting',text:d.greeting}],responses:['{greeting}']},
		{steps:[target,number,{type:'choice',variable:'choice',choices:d.chemistry}],responses:[d.combined]},
		{steps:[],responses:[d.tg],delivery:'announcement',color:'blue'},
		{steps:[],responses:[d.ds],delivery:'announcement',color:'purple'},
		{steps:[],responses:[d.commands],delivery:'announcement',color:'green'}
	];
	return bodies.map((body,i)=>({key:keys[i],command:normalize({...body,name:d.names[i],trigger:d.triggers[i],enabled:false,noTargetText:d.none,invalidTargetText:d.invalid})}));
}
// Ship a ready-to-edit timer without sending anything until explicitly enabled.
function starterAnnouncement(language='ru'){
	const d=copy[language]||copy.ru;
	return require('./announcements.cjs').normalizeTimer({name:d.names[9],text:d.commands,color:'green',enabled:false,intervalMinutes:10,minMessages:5});
}
module.exports={examples,starterAnnouncement};
