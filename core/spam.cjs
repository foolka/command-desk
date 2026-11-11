const copy = {
	ru: {
		warning: (user, command) => `@${user}, не повторяй ${command} подряд. Следующая попытка временно отключит тебе команды, но не чат.`,
		blocked: (user, seconds) => `@${user}, команды заблокированы на ${seconds} сек. за повторы. Писать в чат можно.`
	},
	uk: {
		warning: (user, command) => `@${user}, не повторюй ${command} поспіль. Наступна спроба тимчасово вимкне тобі команди, але не чат.`,
		blocked: (user, seconds) => `@${user}, команди заблоковано на ${seconds} с за повтори. Писати в чат можна.`
	},
	en: {
		warning: (user, command) => `@${user}, please stop repeating ${command}. The next attempt will temporarily block your commands, not chat.`,
		blocked: (user, seconds) => `@${user}, commands are blocked for ${seconds}s due to repetition. You can still chat.`
	}
};

// Keep penalties across reconnects/restarts; reset only for a confirmed new stream/account.
class SpamGuard {
	constructor(store, now = Date.now) {
		this.store = store;
		this.now = now;
		this.state = store.meta?.('spamRuntime', {channel: '', stream: '', viewers: {}}) || {channel: '', stream: '', viewers: {}};
	}
	save() {
		this.store.setMeta?.('spamRuntime', this.state);
	}
	session(channel, stream) {
		if (!channel) return;
		if (this.state.channel !== channel || (stream && this.state.stream !== stream)) {
			this.state = {channel, stream: stream || '', viewers: {}};
			this.save();
		}
	}
	// Count known commands per viewer, including attempts rejected by a personal cooldown.
	check(event, command, config) {
		if (!config.antiSpam) return null;
		this.session(event.channelId || event.channel, null);
		const now = this.now(), key = String(event.userId);
		let viewer = Object.hasOwn(this.state.viewers, key) ? this.state.viewers[key] : {strikes: 0, until: 0, attempts: []};
		if (viewer.until > now) return {reason: 'spamBlocked', messages: [], seconds: Math.ceil((viewer.until - now) / 1000)};
		if (viewer.until) viewer = {...viewer, until: 0, attempts: [], warnedAt: null};
		const windowMs = config.spamWindowSeconds * 1000;
		if (viewer.command !== command.id) viewer = {...viewer, command: command.id, attempts: [], warnedAt: null};
		viewer.attempts = viewer.attempts.filter(at => now - at < windowMs);
		const words = copy[config.language] || copy.ru;
		let result = null;
		if (viewer.warnedAt != null && now - viewer.warnedAt < windowMs) {
			const seconds = viewer.strikes ? config.spamRepeatBlockSeconds : config.spamFirstBlockSeconds;
			viewer.strikes++;
			viewer.until = now + seconds * 1000;
			viewer.attempts = [];
			viewer.warnedAt = null;
			result = {reason: 'spamPenalty', seconds, messages: [words.blocked(event.login, seconds)]};
		} else {
			viewer.warnedAt = null;
			viewer.attempts.push(now);
			if (viewer.attempts.length >= config.spamRepeats) {
				viewer.warnedAt = now;
				result = {reason: 'spamWarning', messages: [words.warning(event.login, command.trigger)]};
			}
		}
		this.state.viewers[key] = viewer;
		this.save();
		return result;
	}
}
const quietMessage={
	ru:'Команды чата на перезарядке. Попробуйте чуть позже.',
	uk:'Команди чату на перезарядці. Спробуйте трохи пізніше.',
	en:'Chat commands are on cooldown. Please try again shortly.'
};

// Count accepted commands, not attempts or the number of lines they send.
class QuietWindow {
	constructor(now=Date.now){this.now=now;this.channel=null;this.clear();}
	clear(){this.accepted=[];this.lastNotice=-Infinity;this.sinceNotice=5;}
	observe(channel){
		if(this.channel!==channel){this.clear();this.channel=channel;}
		this.sinceNotice=Math.min(5,this.sinceNotice+1);
	}
	full(config){
		const cutoff=this.now()-60000;
		while(this.accepted.length&&this.accepted[0]<=cutoff)this.accepted.shift();
		return !!config.quietMode&&this.accepted.length>=(config.quietPerMinute??5);
	}
	record(){this.accepted.push(this.now());}
	canNotify(){return this.sinceNotice>=5&&this.now()-this.lastNotice>=60000;}
	notified(){this.lastNotice=this.now();this.sinceNotice=0;}
}
module.exports = {SpamGuard,QuietWindow,quietMessage};
