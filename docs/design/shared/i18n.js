/*
 * Still Alive — i18n
 * 用法：
 *   <span data-i18n="home_question"></span>
 *   <input data-i18n-placeholder="record_words_placeholder">
 *   <button data-i18n-aria="theme_toggle">
 * JS: SA.t('key', { name: 'X', n: 7 })
 */
(function () {
  var DICT = {
    zh: {
      app_name: "还活着",
      app_name_en: "Still Alive",
      prd_version: "PRD v3.0 · 设计稿索引",
      hero_sub_a: '以"生存确认"和"记忆沉淀"为核心的多端打卡应用。',
      hero_sub_b:
        "本目录索引覆盖账户、主页、打卡、人物、故事、个人六大模块的全部页面，",
      hero_sub_c: "支持<strong>浅色 / 深色</strong>主题切换。",
      theme_toggle: "主题切换",
      lang_toggle: "EN",
      footer_stamp_a: "以呼吸之韵设计",
      footer_stamp_b: "2026 · 杭州",
      footer_stamp_c: "v3.0 — 界面如同一位安静的陪伴者",
      footer_quote_a: '"活着的意义，',
      footer_quote_b: "不在于活了多久，",
      footer_quote_c: "而在于我们如何被记得，",
      footer_quote_d: '又记得了谁。"',

      mod_01_num: "01 / 账户",
      mod_01_title: "账户",
      mod_01_desc: "登录、注册、密码找回。每一次进入，都是一次确认存在的仪式。",
      mod_01_link_login: "登录",
      mod_01_link_register: "注册",
      mod_01_link_forgot: "忘记密码",

      mod_02_num: "02 / 脉搏",
      mod_02_title: "主页",
      mod_02_desc:
        "核心仪表盘。生存状态、快速打卡、生日提醒、信息差与故事入口。",
      mod_02_link_home: "主页 · 今日",

      mod_03_num: "03 / 日子",
      mod_03_title: "打卡",
      mod_03_desc: "每日生存确认。日历、意义记录、补签、连续打卡里程碑。",
      mod_03_link_cal: "日历总览",
      mod_03_link_rec: "意义记录",
      mod_03_link_ms: "里程碑",

      mod_04_num: "04 / 羁绊",
      mod_04_title: "人物",
      mod_04_desc: "对自己重要的人。情感档案、生日提醒、共同经历。",
      mod_04_link_list: "人物列表",
      mod_04_link_detail: "人物详情",

      mod_05_num: "05 / 声音",
      mod_05_title: "故事",
      mod_05_desc:
        "来自仍然在好好生活的人。匿名收录那些以为过不去、最后都过来了的瞬间。",
      mod_05_link_list: "故事流",
      mod_05_link_detail: "故事详情",
      mod_05_link_submit: "投稿",

      mod_06_num: "06 / 自我",
      mod_06_title: "个人",
      mod_06_desc: "个人档案、数据统计、热力图、死亡确认与所有设置。",
      mod_06_link_mine: "我的",
      mod_06_link_death: "死亡确认",
      mod_06_link_settings: "设置",

      mod_07_num: "07 / 网页",
      mod_07_title: "Web 端独立路由",
      mod_07_desc:
        "桌面宽屏布局。<code>/stories</code> 故事流首页，支持 SEO 与未登录访问。",
      mod_07_link_stories: "桌面端故事流",

      home_date_friday: "2026 · 5 月 1 日 · 星期五",
      home_day_count: "第 127 天",
      home_question: "嘿，今天还好吗？",
      home_checked_label: "今天，已确认。",
      home_streak_label: "连续打卡",
      home_cta: "我还在，记下今天",
      home_cta_done: "补充一笔",
      home_section_today: "今日提醒",
      home_birthday_title_pre: "今天是",
      home_birthday_title_tag: "「妈妈」",
      home_birthday_title_post: "的生日",
      home_birthday_sub: "她今年 56 岁了，给她打个电话吧",
      home_section_daily: "每日信息差",
      home_daily_quote:
        '"活着的意义，不在于我们活了多久，而在于我们如何被记得，又记得了谁。"',
      home_daily_src: "— 人间清醒",
      home_section_record: "今天有意义的事",
      home_record_placeholder: "今天让你心头一动的瞬间...",
      home_section_voices: "来自仍然在好好生活的人",
      home_more: "更多 →",
      home_save: "保存",
      home_voice_meta: "2024 冬季 · 意外与事故",
      home_voice_body:
        "车在结冰的山路上滑出去三十米，最后只是撞上了路边的护栏。下车那一刻，我看见月亮挂在松树上，像很久没见的老朋友。我想，原来活着是这样的感觉。",
      home_read: "阅读 →",

      auth_login: "登录",
      auth_register: "注册",
      auth_forgot: "忘记密码",
      auth_mark: "还活着",
      auth_hello: "你好，",
      auth_question: "还活着吗？",
      auth_sub_login: "今天依旧问你同一个温柔的问题",
      auth_tab_phone: "手机号",
      auth_tab_email: "邮箱",
      auth_phone: "手机号",
      auth_otp: "验证码",
      auth_phone_placeholder: "输入手机号",
      auth_otp_placeholder: "六位数字",
      auth_send_otp: "发送 →",
      auth_agree:
        "已阅读并同意《用户协议》《隐私政策》。每一次登录，都是一次确认存在的仪式。",
      auth_confirm: "确认存活",
      auth_new_here_link: "注册账号",
      auth_forgot_link: "忘记密码",
      auth_other_ways: "其他方式",
      auth_register_title: "创建账号",
      auth_register_sub: "开始记录你的存在",
      auth_nickname: "昵称",
      auth_nickname_optional: "选填",
      auth_nickname_placeholder: "给自己起个名字",
      auth_agree_short: "已阅读并同意《用户协议》《隐私政策》",
      auth_create: "注册",
      auth_has_account: "已有账号？",
      auth_go_login: "去登录",
      auth_forgot_title: "找回密码",
      auth_forgot_sub: "我们都会忘记的",
      auth_step_verify: "验证",
      auth_step_new_pwd: "新密码",
      auth_phone_registered: "已注册手机号",
      auth_next: "下一步",
      auth_forgot_note: "密码重置成功后，其他设备将自动退出登录。",
      auth_back: "← 返回",

      checkin_top_mark_a: "2026 · 5 月",
      checkin_top_mark_b: "生存日记",
      checkin_title: "打卡",
      checkin_total: "总天数",
      checkin_streak: "连续",
      checkin_records_label: "记录",
      checkin_calendar: "月度",
      checkin_recent: "近期记录",
      checkin_record_link: "记录 →",
      checkin_checked: "已打卡",
      checkin_retro_label: "补签",
      checkin_today_label: "今天",
      checkin_empty_record: "— 纯粹打卡，没有记录 —",
      checkin_retro_title: "补签",
      checkin_retro_desc: "7 天窗口 · 本月剩余 2 次",
      checkin_happy: "开心",
      checkin_record_1:
        "下了一场大雨，透过窗户看外面出了彩虹。突然觉得活着其实有很多不期而遇的美好。",
      checkin_record_3:
        "和老朋友通了两小时的电话，聊了大学时的事。有些记忆只有讲出来才不会彻底消失。",

      record_top_title: "记录",
      record_title: "今天有意义的事",
      record_sub_a: "2026·05·01 · 给未来的自己一份小礼物。",
      record_sub_b: "—— 也可以什么都不写。",
      record_photo: "今天的一张",
      record_photo_upload: "上传今天的一帧",
      record_words: "文字记录",
      record_words_placeholder: "什么让你觉得今天和昨天不一样？...",
      record_words_sample:
        "下了一场大雨，透过窗户看外面出了彩虹。突然觉得活着其实有很多不期而遇的美好。",
      record_mood: "心情（可选）",
      record_mood_happy: "😊 开心",
      record_mood_calm: "😌 平静",
      record_mood_down: "😔 低落",
      record_mood_tired: "😴 疲惫",
      record_mood_angry: "😡 烦躁",
      record_mood_touched: "🥲 感动",
      record_skip: "什么都不写",
      record_save: "保存",

      milestone_tag: "里程碑 · 100 天",
      milestone_heading_a: "100 天，",
      milestone_heading_b: "你已经证明了自己",
      milestone_sub: "你温柔地证明了它。",
      milestone_quote_1: '100 个"还活着"，',
      milestone_quote_2: "拼成了只属于你的勋章。",
      milestone_quote_3: "认真地活，认真地记录，",
      milestone_quote_4: "这件事本身就很了不起。",
      milestone_all: "全部里程碑",
      milestone_done: "已达成",
      milestone_today_label: "今天",
      milestone_continue: "继续活着 →",

      person_top_mark: "人物 · 羁绊",
      person_souls: "8 位",
      person_title: "人物",
      person_subtitle: '那些塑造了你"还活着"感觉的人',
      person_search_placeholder: "搜索姓名...",
      person_all: "全部",
      person_family: "家人",
      person_friends: "朋友",
      person_work: "同事",
      person_add: "+ 添加",
      person_today_birthday: "今日生日",
      person_today_card_name: "妈妈",
      person_today_card_meta: "56 岁 · ENFJ · 家人",
      person_greet: "问候",
      person_section_all: "全部 ({n})",
      person_info: "基本信息",
      person_birthday_label: "生日",
      person_birthday_value: "1970·05·01 · 56 岁",
      person_theme_label: "主题色",
      person_impression: "个人印象",
      person_impression_text:
        '永远在厨房忙碌的人。她不太会直接说爱，但每次回家，桌上永远多一道你随口提过的菜。她年纪大了开始用微信，学得很慢，但会给你发那些很模糊的风景照，下面写着"今天天气好"。',
      person_memories: "共同经历",
      person_add_memory: "+ 添加",
      person_dates: "重要日期",
      person_add_date: "+ 添加",
      person_birthday: "生日",
      person_mothers_day: "母亲节",
      person_mothers_day_value: "5 月第二个周日",
      person_today_badge: "今天",
      person_days_left: "还有 {n} 天",
      person_edit: "编辑",
      person_memory_1_date: "2024 · 春节",
      person_memory_1_text:
        "一起包了 200 个饺子。她手快得像机器，我在一旁负责把馅料团歪。那天她笑了很多次。",
      person_memory_2_date: "2023 · 9 月",
      person_memory_2_text:
        "带她去了第一次坐飞机，落地的时候她一直拍窗户外面，像个小孩。",
      person_tag_family: "家人",
      person_tag_friends: "朋友",
      person_today_emoji: "🎂 今天",

      story_title: "故事",
      story_subtitle: "来自仍然在好好生活的人",
      story_all: "全部",
      story_accident: "意外",
      story_illness: "疾病",
      story_mental: "心理",
      story_nature: "自然",
      story_other: "其他",
      story_random: "随机一则",
      story_content_warning: "内容提醒",
      story_content_warning_text: "这则故事涉及心理健康相关的敏感内容。",
      story_reveal: "查看 →",
      story_loading: "加载更多...",
      story_resonance_label: "感同身受",
      story_copy: "复制文本",
      story_share_image: "分享图片",
      story_helpline_label: "如果你正在经历类似的时刻：",
      story_helpline_numbers:
        "北京心理危机研究与干预中心 010-82951332 · 全国心理援助热线 400-161-9995 · 生命热线 400-821-1215",
      story_meta_winter: "2024 冬季 · 意外",
      story_meta_summer: "2023 夏季 · 疾病",
      story_meta_autumn: "2022 秋季 · 自然",
      story_card_winter_body:
        "车在结冰的山路上滑出去三十米，最后只是撞上了路边的护栏。下车那一刻，我看见月亮挂在松树上，像很久没见的老朋友。我想，原来活着是这样的感觉。",
      story_card_summer_title: "那三个月，我学会了和自己待着",
      story_card_summer_body:
        "确诊那天天气很好。医生说得很平静，像在念菜单。我走出诊室，发现走廊的阳光落在我鞋面上，那一刻什么都没想，就站着看了很久...",
      story_card_autumn_body:
        "在云南徒步的第四天，我在 4800 米的垭口遇到了暴风雪。向导说不能停下来。那半小时里我一直在默念回去要做的事——突然发现，我从来没这么想活过。",
      story_detail_meta: "2024 冬季 · 意外",
      story_detail_p1:
        "车在结冰的山路上滑出去三十米，最后只是撞上了路边的护栏。",
      story_detail_p2:
        "那一刻时间好像停了。引擎还在响，挡风玻璃上有一道很长的裂缝，像一条弯弯的河。我坐在驾驶座上，手还握着方向盘，心跳快得像有人在我胸口打鼓。",
      story_detail_p3:
        "过了不知道多久，我下了车。脚踩在雪里，发出很脆的声音。风把树上的雪吹下来，落在我肩膀上。",
      story_detail_p4: "然后我看见月亮挂在松树上，像很久没见的老朋友。",
      story_detail_p5:
        "我站在那条空荡荡的山路上，零下十几度，身上穿着薄薄的夹克。但我没觉得冷，只觉得——噢，原来活着是这样的感觉。不是什么激动或者庆幸，就只是一种很安静的确认：我还在这里。",
      story_detail_p6:
        "后来拖车来了，保险理赔了，护栏也修好了。生活回到了正轨，好像那天晚上什么都没发生过。",
      story_detail_p7:
        "但我知道有什么不一样了。每次冬天的晚上开车，我会多看一眼月亮。",

      submit_top_title: "投稿",
      submit_title: "讲述你的故事",
      submit_intro_a: "这里收录那些以为过不去、最后都过来了的瞬间。",
      submit_intro_b: "关注活下来之后的感受，而不是经历本身。",
      submit_intro_c: "故事完全匿名，经审核后发布。",
      submit_field_title: "标题 / 首句",
      submit_field_title_optional: "选填 · ≤30",
      submit_field_title_placeholder: "为你的故事起一个开头",
      submit_field_body: "正文",
      submit_field_body_req: "100~800",
      submit_field_body_placeholder:
        "讲述那个你以为过不去、但最终走过来了的瞬间...",
      submit_field_when: "大致时间",
      submit_field_when_placeholder: "例：2024 年冬、三年前",
      submit_field_category: "故事类型",
      submit_cat_accident: "意外",
      submit_cat_illness: "疾病",
      submit_cat_mental: "心理",
      submit_cat_nature: "自然",
      submit_cat_other: "其他",
      submit_field_email: "联系邮箱",
      submit_field_email_placeholder: "审核通知用，可不填",
      submit_review_note: "48 小时内审核",
      submit_btn: "提交故事",

      profile_top_mark: "我的",
      profile_day: "第 127 天",
      profile_title: "我的",
      profile_id_meta_a: "已确认存活",
      profile_id_meta_b: "天",
      profile_stats: "数据",
      profile_days: "生存",
      profile_people: "人物",
      profile_records: "记录",
      profile_heatmap_title: "2026 像素图",
      profile_heatmap_sub: "52 周 · 365 天",
      profile_legend_less: "少",
      profile_legend_more: "多",
      profile_milestones: "成就",
      profile_settings: "设置",
      profile_death_confirm: "死亡确认",
      profile_death_sub: "通知亲属",
      profile_my_stories: "我的投稿",
      profile_my_stories_sub: "已投稿故事",
      profile_settings_sub: "提醒 · 主题 · 隐私",
      profile_about: "关于我们",
      profile_about_sub: "你的日子值得被记住",
      profile_badge_7: "7 天",
      profile_badge_30: "30 天",
      profile_badge_100: "100 天",
      profile_badge_365: "365 天",
      profile_badge_1000: "1000 天",

      death_top_title: "死亡确认",
      death_title: "死亡确认",
      death_warning:
        '当你连续多天未打卡时，系统将向你设定的紧急联系人发送一封"死亡确认"邮件。这不是诅咒，只是一种温柔的牵挂。',
      death_switch: "开关",
      death_enable: "启用死亡确认",
      death_enable_sub: "开启后生效",
      death_days: "触发天数",
      death_days_note: "连续 7 天未打卡后触发通知",
      death_contact: "紧急联系人",
      death_contact_note: "此邮箱将收到确认邮件",
      death_preview: "邮件预览",
      death_email_subject: "关于 Let me 的生存确认",
      death_email_body_1: "你好，",
      death_email_body_2_a: "用户",
      death_email_body_2_b: '已连续 7 天未在"还活着"应用中确认存活。',
      death_email_body_3:
        "这封邮件并不意味着什么，但如果方便的话，请确认 TA 是否安好。",
      death_email_sign: "—— 来自「还活着」",

      settings_top_title: "设置",
      settings_title: "设置",
      settings_reminder: "打卡提醒",
      settings_daily: "每日提醒",
      settings_daily_sub: "每日推送通知",
      settings_time: "提醒时间",
      settings_time_sub: "推送 · 本地 / 微信 / 浏览器",
      settings_appearance: "外观",
      settings_light: "浅色",
      settings_dark: "深色",
      settings_system: "跟随系统",
      settings_notifications: "通知",
      settings_birthday_notify: "生日提醒",
      settings_milestone_notify: "里程碑通知",
      settings_story_notify: "投稿审核",
      settings_data: "数据",
      settings_backup: "数据备份",
      settings_backup_sub: "导出所有数据",
      settings_cache: "清除缓存",
      settings_help: "帮助",
      settings_feedback: "帮助与反馈",
      settings_terms: "用户协议",
      settings_privacy: "隐私政策",
      settings_logout: "退出登录",
      settings_version: "v3.0 · 你的日子值得被记住",

      nav_home: "主页",
      nav_checkin: "打卡",
      nav_person: "人物",
      nav_mine: "我的",
      nav_stories: "故事",
      nav_submit: "投稿",
      nav_about: "关于",
      nav_login: "登录",

      web_stories_hero_a: '每一则故事都是一份"仍然在好好生活"的证明。',
      web_stories_hero_b: "这里收录那些以为过不去、最后都过来了的瞬间。",
      web_stories_category: "分类",
      web_stories_random: "随机",
      web_footer_brand: "还活着",
      web_footer_about: "关于",
      web_footer_terms: "条款",
      web_footer_privacy: "隐私",
    },

    en: {
      app_name: "Still Alive",
      app_name_en: "Still Alive",
      prd_version: "PRD v3.0 · Design Index",
      hero_sub_a:
        'A multi-platform check-in app centered on "survival confirmation" and "memory sedimentation."',
      hero_sub_b:
        "This index covers all pages across six modules: account, home, check-in, people, stories, and profile,",
      hero_sub_c: "with <strong>light / dark</strong> theme support.",
      theme_toggle: "Toggle theme",
      lang_toggle: "中",
      footer_stamp_a: "Designed with breath",
      footer_stamp_b: "2026 · Hangzhou",
      footer_stamp_c: "v3.0 — interface as a quiet companion",
      footer_quote_a: '"The meaning of being alive',
      footer_quote_b: "lies not in how long we live,",
      footer_quote_c: "but in how we are remembered,",
      footer_quote_d: 'and whom we remember."',

      mod_01_num: "01 / Account",
      mod_01_title: "Account",
      mod_01_desc:
        "Login, registration, password recovery. Every entry is a ritual of confirming existence.",
      mod_01_link_login: "Login",
      mod_01_link_register: "Register",
      mod_01_link_forgot: "Forgot password",

      mod_02_num: "02 / Pulse",
      mod_02_title: "Home",
      mod_02_desc:
        "Core dashboard. Survival status, quick check-in, birthday reminders, daily insights, story entrance.",
      mod_02_link_home: "Home · Today",

      mod_03_num: "03 / Days",
      mod_03_title: "Check-in",
      mod_03_desc:
        "Daily survival confirmation. Calendar, meaningful records, retro check-ins, streak milestones.",
      mod_03_link_cal: "Calendar Overview",
      mod_03_link_rec: "Meaningful Record",
      mod_03_link_ms: "Milestones",

      mod_04_num: "04 / Bonds",
      mod_04_title: "People",
      mod_04_desc:
        "Those who matter. Emotional profiles, birthday reminders, shared memories.",
      mod_04_link_list: "People List",
      mod_04_link_detail: "Person Detail",

      mod_05_num: "05 / Voices",
      mod_05_title: "Stories",
      mod_05_desc:
        "From those still living, gently. Anonymously collected moments of thinking you couldn't get through it — and somehow, you did.",
      mod_05_link_list: "Story Feed",
      mod_05_link_detail: "Story Detail",
      mod_05_link_submit: "Submit",

      mod_06_num: "06 / Self",
      mod_06_title: "Profile",
      mod_06_desc:
        "Personal profile, statistics, heatmap, death confirmation, all settings.",
      mod_06_link_mine: "Mine",
      mod_06_link_death: "Death Confirmation",
      mod_06_link_settings: "Settings",

      mod_07_num: "07 / Web",
      mod_07_title: "Web Routes",
      mod_07_desc:
        "Desktop widescreen layout. <code>/stories</code> homepage with SEO and guest access.",
      mod_07_link_stories: "Desktop Story Feed",

      home_date_friday: "2026 · MAY 1 · FRIDAY",
      home_day_count: "Day 127",
      home_question: "Hey, how are you today?",
      home_checked_label: "Confirmed, today.",
      home_streak_label: "Consecutive days",
      home_cta: "I'm still here. Log today.",
      home_cta_done: "Add a note",
      home_section_today: "Today's Reminder",
      home_birthday_title_pre: "Today is ",
      home_birthday_title_tag: "Mom's",
      home_birthday_title_post: " birthday",
      home_birthday_sub: "She turns 56 today. Give her a call.",
      home_section_daily: "Daily Insight",
      home_daily_quote:
        '"The meaning of being alive lies not in how long we live, but in how we are remembered, and whom we remember."',
      home_daily_src: "— A Sober Life",
      home_section_record: "Something meaningful today",
      home_record_placeholder: "A moment that moved you today...",
      home_section_voices: "From those still living, gently",
      home_more: "More →",
      home_save: "Save",
      home_voice_meta: "WINTER 2024 · ACCIDENT",
      home_voice_body:
        "The car slid thirty meters on an icy mountain road and finally only hit the guardrail. The moment I stepped out, I saw the moon hanging on a pine tree, like an old friend I hadn't seen in a long time. I thought — so this is what being alive feels like.",
      home_read: "Read →",

      auth_login: "Login",
      auth_register: "Register",
      auth_forgot: "Forgot Password",
      auth_mark: "Still Alive",
      auth_hello: "Hello,",
      auth_question: "are you still alive?",
      auth_sub_login: "today asks the same gentle question",
      auth_tab_phone: "Phone",
      auth_tab_email: "Email",
      auth_phone: "Phone",
      auth_otp: "Verification code",
      auth_phone_placeholder: "your number",
      auth_otp_placeholder: "six digits",
      auth_send_otp: "Send →",
      auth_agree:
        "I have read and agree to the Terms of Service and Privacy Policy. Every login is a ritual of confirming existence.",
      auth_confirm: "Confirm I'm here",
      auth_new_here_link: "New here",
      auth_forgot_link: "Forgot password",
      auth_other_ways: "Other ways",
      auth_register_title: "Create account",
      auth_register_sub: "begin recording your aliveness",
      auth_nickname: "Nickname",
      auth_nickname_optional: "Optional",
      auth_nickname_placeholder: "give yourself a name",
      auth_agree_short:
        "I have read and agree to the Terms of Service and Privacy Policy",
      auth_create: "Create",
      auth_has_account: "Already have an account? ",
      auth_go_login: "Log in",
      auth_forgot_title: "Forgot",
      auth_forgot_sub: "we all forget sometimes",
      auth_step_verify: "Verify",
      auth_step_new_pwd: "New Password",
      auth_phone_registered: "registered number",
      auth_next: "Next",
      auth_forgot_note:
        "After password reset, other devices will be automatically signed out.",
      auth_back: "← Back",

      checkin_top_mark_a: "2026 · MAY",
      checkin_top_mark_b: "Days alive",
      checkin_title: "Check-in",
      checkin_total: "Total",
      checkin_streak: "Streak",
      checkin_records_label: "Records",
      checkin_calendar: "Monthly",
      checkin_recent: "Recent records",
      checkin_record_link: "Record →",
      checkin_checked: "Checked",
      checkin_retro_label: "Retro",
      checkin_today_label: "Today",
      checkin_empty_record: "— Pure check-in, no record —",
      checkin_retro_title: "Retroactive",
      checkin_retro_desc: "7-day window · 2 left this month",
      checkin_happy: "Happy",
      checkin_record_1:
        "It rained heavily, and through the window I saw a rainbow. I suddenly realized that being alive holds many unexpected joys.",
      checkin_record_3:
        "Talked with an old friend for two hours about college days. Some memories only survive by being spoken aloud.",

      record_top_title: "Record",
      record_title: "Today",
      record_sub_a: "2026·05·01 · A small gift to your future self.",
      record_sub_b: "—— Or write nothing at all.",
      record_photo: "Today's photo",
      record_photo_upload: "upload one frame of today",
      record_words: "Words",
      record_words_placeholder: "What made today different from yesterday?...",
      record_words_sample:
        "It rained heavily, and through the window I saw a rainbow. I suddenly realized that being alive holds many unexpected joys.",
      record_mood: "Mood (optional)",
      record_mood_happy: "😊 Happy",
      record_mood_calm: "😌 Calm",
      record_mood_down: "😔 Down",
      record_mood_tired: "😴 Tired",
      record_mood_angry: "😡 Irritated",
      record_mood_touched: "🥲 Touched",
      record_skip: "Skip",
      record_save: "Save",

      milestone_tag: "Milestone · 100 Days",
      milestone_heading_a: "100 days,",
      milestone_heading_b: "you've proved yourself",
      milestone_sub: "You've proved it, gently.",
      milestone_quote_1: '100 "still alive"s',
      milestone_quote_2: "form a medal that belongs only to you.",
      milestone_quote_3: "Living earnestly, recording earnestly —",
      milestone_quote_4: "that itself is remarkable.",
      milestone_all: "All milestones",
      milestone_done: "Done",
      milestone_today_label: "Today",
      milestone_continue: "Keep living →",

      person_top_mark: "People · Bonds",
      person_souls: "8 souls",
      person_title: "Bonds",
      person_subtitle: "Those who shape your aliveness",
      person_search_placeholder: "search by name...",
      person_all: "All",
      person_family: "Family",
      person_friends: "Friends",
      person_work: "Work",
      person_add: "+ Add",
      person_today_birthday: "Today's Birthday",
      person_today_card_name: "Mom",
      person_today_card_meta: "56 yrs · ENFJ · Family",
      person_greet: "Greet",
      person_section_all: "All people ({n})",
      person_info: "Info",
      person_birthday_label: "Birthday",
      person_birthday_value: "1970·05·01 · 56 yrs",
      person_theme_label: "Theme",
      person_impression: "Impression",
      person_impression_text:
        "The one always busy in the kitchen. She doesn't say love directly, but every time you come home, there's an extra dish you casually mentioned. As she got older she started using WeChat, learning slowly, sending blurry landscape photos with \"Nice weather today\" written below.",
      person_memories: "Memories",
      person_add_memory: "+ Add",
      person_dates: "Important dates",
      person_add_date: "+ Add",
      person_birthday: "Birthday",
      person_mothers_day: "Mother's Day",
      person_mothers_day_value: "Second Sunday of May",
      person_today_badge: "Today",
      person_days_left: "+{n} days",
      person_edit: "Edit",
      person_memory_1_date: "2024 · Spring Festival",
      person_memory_1_text:
        "We made 200 dumplings together. Her hands moved like a machine, mine kept misshaping the filling. She laughed many times that day.",
      person_memory_2_date: "2023 · September",
      person_memory_2_text:
        "I took her on her first flight. When we landed she kept tapping the window like a child.",
      person_tag_family: "Family",
      person_tag_friends: "Friend",
      person_today_emoji: "🎂 TODAY",

      story_title: "Voices",
      story_subtitle: "from those still living, gently",
      story_all: "All",
      story_accident: "Accident",
      story_illness: "Illness",
      story_mental: "Mental",
      story_nature: "Nature",
      story_other: "Other",
      story_random: "Random story",
      story_content_warning: "Content warning",
      story_content_warning_text:
        "This story contains sensitive content related to mental health.",
      story_reveal: "Reveal →",
      story_loading: "Loading more...",
      story_resonance_label: "Resonate",
      story_copy: "Copy text",
      story_share_image: "Share image",
      story_helpline_label: "If you're going through a similar moment:",
      story_helpline_numbers:
        "Beijing Psychological Crisis Center 010-82951332 · National Psychological Aid Hotline 400-161-9995 · Life Hotline 400-821-1215",
      story_meta_winter: "WINTER 2024 · ACCIDENT",
      story_meta_summer: "SUMMER 2023 · ILLNESS",
      story_meta_autumn: "AUTUMN 2022 · NATURE",
      story_card_winter_body:
        "The car slid thirty meters on an icy mountain road and finally only hit the guardrail. The moment I stepped out, I saw the moon hanging on a pine tree, like an old friend I hadn't seen in a long time. I thought — so this is what being alive feels like.",
      story_card_summer_title:
        "Those three months, I learned to be with myself",
      story_card_summer_body:
        "The day of the diagnosis was beautiful. The doctor spoke calmly, like reciting a menu. I walked out of the office and noticed sunlight falling on my shoes. For a long moment, I just stood there, thinking nothing...",
      story_card_autumn_body:
        "On day four of the Yunnan trek, I hit a blizzard at a 4,800m pass. The guide said we couldn't stop. For half an hour I kept reciting things I'd do back home — and suddenly realized I'd never wanted to live this much.",
      story_detail_meta: "WINTER 2024 · ACCIDENT",
      story_detail_p1:
        "The car slid thirty meters on an icy mountain road and finally only hit the guardrail.",
      story_detail_p2:
        "Time seemed to stop. The engine was still running, the windshield bore a long crack like a winding river. I sat in the driver's seat, hands on the wheel, heart pounding like someone was drumming on my chest.",
      story_detail_p3:
        "After who knows how long, I got out. My feet crunched in the snow. The wind blew snow off the trees onto my shoulders.",
      story_detail_p4:
        "And then I saw the moon hanging on a pine tree, like an old friend I hadn't seen in a long time.",
      story_detail_p5:
        "I stood on that empty mountain road, in minus ten-something degrees, wearing only a thin jacket. But I didn't feel cold. I just felt — oh, so this is what being alive feels like. Not excitement or relief, just a very quiet confirmation: I'm still here.",
      story_detail_p6:
        "Later the tow truck came, insurance paid, the guardrail got fixed. Life went back to normal, as if nothing had happened that night.",
      story_detail_p7:
        "But I knew something was different. Every winter night when I drive, I take an extra glance at the moon.",

      submit_top_title: "Submit",
      submit_title: "Tell yours",
      submit_intro_a:
        "A collection of moments where you thought you couldn't get through — and somehow, you did.",
      submit_intro_b:
        "Focusing on what you felt after, rather than the experience itself.",
      submit_intro_c: "All stories are anonymous and published after review.",
      submit_field_title: "Title / Opening",
      submit_field_title_optional: "Optional · ≤30",
      submit_field_title_placeholder: "give your story an opening",
      submit_field_body: "Body",
      submit_field_body_req: "100~800",
      submit_field_body_placeholder:
        "tell us about the moment you thought you couldn't get through — and what it felt like when you did...",
      submit_field_when: "When",
      submit_field_when_placeholder: "e.g. winter 2024, three years ago",
      submit_field_category: "Category",
      submit_cat_accident: "Accident",
      submit_cat_illness: "Illness",
      submit_cat_mental: "Mental",
      submit_cat_nature: "Nature",
      submit_cat_other: "Other",
      submit_field_email: "Contact email",
      submit_field_email_placeholder: "for review notification, optional",
      submit_review_note: "Review within 48 hours",
      submit_btn: "Submit story",

      profile_top_mark: "Profile · Mine",
      profile_day: "Day 127",
      profile_title: "Mine",
      profile_id_meta_a: "Confirmed alive for",
      profile_id_meta_b: "days",
      profile_stats: "Stats",
      profile_days: "Days",
      profile_people: "People",
      profile_records: "Records",
      profile_heatmap_title: "2026 in pixels",
      profile_heatmap_sub: "52 weeks · 365 days",
      profile_legend_less: "Less",
      profile_legend_more: "More",
      profile_milestones: "Milestones",
      profile_settings: "Settings",
      profile_death_confirm: "Death Confirmation",
      profile_death_sub: "Notify next of kin",
      profile_my_stories: "My Submissions",
      profile_my_stories_sub: "Submitted stories",
      profile_settings_sub: "Reminders · Theme · Privacy",
      profile_about: "About Us",
      profile_about_sub: "Your days deserve to be remembered",
      profile_badge_7: "7 days",
      profile_badge_30: "30 days",
      profile_badge_100: "100 days",
      profile_badge_365: "365 days",
      profile_badge_1000: "1000 days",

      death_top_title: "Death",
      death_title: "Memento",
      death_warning:
        "When you don't check in for several consecutive days, the system will send a \"death confirmation\" email to your designated emergency contact. It's not a curse, just a gentle form of care.",
      death_switch: "Switch",
      death_enable: "Enable Death Confirmation",
      death_enable_sub: "Takes effect when enabled",
      death_days: "Trigger days",
      death_days_note:
        "Notification triggered after 7 consecutive days without check-in",
      death_contact: "Emergency contact",
      death_contact_note: "This email will receive the confirmation",
      death_preview: "Email preview",
      death_email_subject: "Survival Confirmation for Let me",
      death_email_body_1: "Hello,",
      death_email_body_2_a: "User",
      death_email_body_2_b:
        "has not confirmed survival in the Still Alive app for 7 consecutive days.",
      death_email_body_3:
        "This email doesn't mean anything is wrong, but if convenient, please check if they are okay.",
      death_email_sign: "—— From Still Alive",

      settings_top_title: "Settings",
      settings_title: "Settings",
      settings_reminder: "Check-in reminder",
      settings_daily: "Daily reminder",
      settings_daily_sub: "Daily push notification",
      settings_time: "Reminder time",
      settings_time_sub: "Push · Local / WeChat / Browser",
      settings_appearance: "Appearance",
      settings_light: "Light",
      settings_dark: "Dark",
      settings_system: "System",
      settings_notifications: "Notifications",
      settings_birthday_notify: "Birthday reminders",
      settings_milestone_notify: "Milestone notifications",
      settings_story_notify: "Submission review",
      settings_data: "Data & Privacy",
      settings_backup: "Data backup",
      settings_backup_sub: "Export all data",
      settings_cache: "Clear cache",
      settings_help: "Help",
      settings_feedback: "Help & Feedback",
      settings_terms: "Terms of Service",
      settings_privacy: "Privacy Policy",
      settings_logout: "Log out",
      settings_version: "v3.0 · Your days deserve to be remembered",

      nav_home: "Home",
      nav_checkin: "Check-in",
      nav_person: "People",
      nav_mine: "Mine",
      nav_stories: "Stories",
      nav_submit: "Submit",
      nav_about: "About",
      nav_login: "Log in",

      web_stories_hero_a: "Every story is proof of still living, gently.",
      web_stories_hero_b:
        "A collection of moments where you thought you couldn't get through — and somehow, you did.",
      web_stories_category: "Category",
      web_stories_random: "Random",
      web_footer_brand: "Still Alive",
      web_footer_about: "About",
      web_footer_terms: "Terms",
      web_footer_privacy: "Privacy",
    },
  };

  var K = "sa-lang";

  function getLang() {
    var s = localStorage.getItem(K);
    if (s === "zh" || s === "en") return s;
    var nav = (navigator.language || "zh").toLowerCase();
    return nav.indexOf("zh") === 0 ? "zh" : "en";
  }

  function t(key, vars) {
    var lang = getLang();
    var dict = DICT[lang] || DICT.zh;
    var s = dict[key];
    if (s == null) return key;
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        s = s.replace(new RegExp("\\{" + k + "\\}", "g"), vars[k]);
      });
    }
    return s;
  }

  function applyAll() {
    var lang = getLang();
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";

    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      var html = el.getAttribute("data-i18n-html") === "true";
      var v = t(key);
      if (html) el.innerHTML = v;
      else el.textContent = v;
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      el.setAttribute(
        "placeholder",
        t(el.getAttribute("data-i18n-placeholder")),
      );
    });
    document.querySelectorAll("[data-i18n-aria]").forEach(function (el) {
      el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria")));
    });
    document.querySelectorAll("[data-i18n-title]").forEach(function (el) {
      el.setAttribute("title", t(el.getAttribute("data-i18n-title")));
    });
    document.querySelectorAll("[data-i18n-value]").forEach(function (el) {
      el.value = t(el.getAttribute("data-i18n-value"));
    });
    var titleEl = document.querySelector("title[data-i18n-title-key]");
    if (titleEl) {
      var pageKey = titleEl.getAttribute("data-i18n-title-key");
      titleEl.textContent = t(pageKey) + " · " + t("app_name");
    }
    var btn = document.getElementById("lang-toggle");
    if (btn) btn.textContent = t("lang_toggle");

    document.dispatchEvent(
      new CustomEvent("sa:lang", { detail: { lang: lang } }),
    );
  }

  function setLang(l) {
    localStorage.setItem(K, l);
    applyAll();
  }

  function toggle() {
    setLang(getLang() === "zh" ? "en" : "zh");
  }

  function init() {
    applyAll();
    document.addEventListener("click", function (e) {
      if (e.target.closest("#lang-toggle")) toggle();
    });
  }

  window.SA = window.SA || {};
  window.SA.t = t;
  window.SA.getLang = getLang;
  window.SA.setLang = setLang;
  window.SA.applyI18n = applyAll;

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})();
