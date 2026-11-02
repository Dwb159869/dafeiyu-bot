// 本插件新增（不在 AstrBot 里）：把 OneBot 通知和请求写成一句中文，放进 AstrBotMessage.event_text，
// 给记忆等插件看。名字由调用方查好传进来。
const who = (name, id) => (name && name !== String(id) ? name + '(' + id + ')' : String(id));
export function describeNotice(event, n, selfId) {
    const user = who(n.user, event.user_id);
    const operator = event.operator_id !== undefined ? who(n.operator, event.operator_id) : '';
    const byOperator = operator && String(event.operator_id) !== String(event.user_id) ? '（操作人 ' + operator + '）' : '';
    switch (event.notice_type) {
        case 'group_increase':
            return user + ' 加入了群' + (event.sub_type === 'invite' ? '（被邀请）' : '') + byOperator;
        case 'group_decrease':
            if (event.sub_type === 'kick_me')
                return '机器人被移出了群' + byOperator;
            if (event.sub_type === 'kick')
                return user + ' 被移出了群' + byOperator;
            return user + ' 退出了群';
        case 'group_admin':
            return user + (event.sub_type === 'set' ? ' 成为了管理员' : ' 不再是管理员');
        case 'group_ban':
            if (event.sub_type === 'lift_ban')
                return user + ' 被解除禁言' + byOperator;
            if (String(event.user_id) === '0')
                return '全员禁言' + byOperator;
            return user + ' 被禁言 ' + event.duration + ' 秒' + byOperator;
        case 'group_upload':
            return user + ' 上传了群文件 ' + (event.file?.name ?? '');
        case 'group_recall':
        case 'friend_recall':
            return user + ' 撤回了一条消息' + byOperator + (n.recalled ? '：' + n.recalled : '');
        case 'friend_add':
            return user + ' 成为了好友';
        case 'group_card':
            return user + ' 把群名片从「' + (event.card_old ?? '') + '」改成了「' + (event.card_new ?? '') + '」';
        case 'essence':
            return (event.sub_type === 'delete' ? '取消了一条精华消息' : '设置了一条精华消息') + byOperator;
        case 'group_msg_emoji_like':
            return user + ' 给一条消息点了表情回应';
        case 'notify':
            switch (event.sub_type) {
                case 'poke': {
                    const target = String(event.target_id) === selfId ? '机器人' : who(n.target, event.target_id);
                    return user + ' 戳了戳 ' + target;
                }
                case 'lucky_king':
                    return who(n.target, event.target_id) + ' 成为了运气王';
                case 'honor':
                    return user + ' 获得了群荣誉 ' + (event.honor_type ?? '');
                case 'title':
                    return user + ' 获得了头衔「' + (event.title ?? '') + '」';
                case 'input_status':
                    return user + ' 正在输入';
                case 'profile_like':
                    return user + ' 给机器人点了赞';
                default:
                    return '通知 notify.' + event.sub_type;
            }
        default:
            return '通知 ' + event.notice_type + (event.sub_type ? '.' + event.sub_type : '');
    }
}
export function describeRequest(event, n) {
    const user = who(n.user, event.user_id);
    const comment = event.comment ? '，附言：' + event.comment : '';
    if (event.request_type === 'friend')
        return user + ' 请求加好友' + comment;
    if (event.request_type === 'group') {
        if (event.sub_type === 'invite')
            return user + ' 邀请机器人加入群 ' + event.group_id + comment;
        return user + ' 申请加入群' + comment;
    }
    return '请求 ' + event.request_type;
}
