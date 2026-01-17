# 人物模块 (personStore)

> 管理人物档案的增删改查、搜索和生日提醒。

**依赖**: authStore

---

## US-PERSON-01: 添加人物

```
作为 用户，
我想要 添加重要的人物档案，
以便 记录与他们的情感连接。

验收标准：
- [ ] 必填：姓名/称呼
- [ ] 选填：性别、生日、照片、MBTI
- [ ] 选填：个人印象、共同经历
- [ ] 添加成功后返回列表页

状态需求：
- isCreating: boolean
- createError: string | null
```

---

## US-PERSON-02: 查看人物列表

```
作为 用户，
我想要 查看所有已添加的人物，
以便 快速浏览我记录的重要人物。

验收标准：
- [ ] 卡片展示：头像、姓名、MBTI、生日
- [ ] 支持按添加时间/生日临近排序
- [ ] 点击进入人物详情页
- [ ] 显示人物总数

状态需求：
- persons: Person[]
- isLoading: boolean
- sortBy: 'createdAt' | 'birthday'
```

---

## US-PERSON-03: 搜索人物

```
作为 用户，
我想要 按姓名搜索人物，
以便 快速找到特定的人。

验收标准：
- [ ] 输入关键词实时筛选
- [ ] 搜索结果高亮匹配文字
- [ ] 无结果时显示提示

状态需求：
- searchKeyword: string
- filteredPersons: Person[]
```

---

## US-PERSON-04: 查看人物详情

```
作为 用户，
我想要 查看某个人物的完整档案，
以便 回顾我与这个人的情感记录。

验收标准：
- [ ] 显示所有人物信息字段
- [ ] 显示"共同经历"时间线
- [ ] 支持编辑和删除操作

状态需求：
- currentPerson: Person | null
- isDetailLoading: boolean
```

---

## US-PERSON-05: 编辑人物

```
作为 用户，
我想要 修改人物档案信息，
以便 更新或补充记录内容。

验收标准：
- [ ] 可修改所有字段
- [ ] 保存成功显示提示
- [ ] 支持删除人物（二次确认）

状态需求：
- isUpdating: boolean
- updateError: string | null
```

---

## US-PERSON-06: 今日生日提醒

```
作为 用户，
我想要 在打卡时看到今日过生日的人物，
以便 不忘记给重要的人送上祝福。

验收标准：
- [ ] 仅在有人物生日当天显示
- [ ] 显示生日人物头像和姓名
- [ ] 点击可跳转人物详情
- [ ] 显示年龄（如有出生年份）

状态需求：
- todayBirthdays: Person[]
```

---

## 状态定义

```typescript
interface PersonState {
  // 列表状态
  persons: Person[];
  isLoading: boolean;
  sortBy: 'createdAt' | 'birthday';

  // 搜索状态
  searchKeyword: string;
  filteredPersons: Person[];

  // 详情状态
  currentPerson: Person | null;
  isDetailLoading: boolean;

  // 创建/更新状态
  isCreating: boolean;
  createError: string | null;
  isUpdating: boolean;
  updateError: string | null;

  // 生日提醒
  todayBirthdays: Person[];

  // Actions
  fetchPersons: () => Promise<void>;
  fetchPerson: (id: string) => Promise<void>;
  createPerson: (data: CreatePersonInput) => Promise<void>;
  updatePerson: (id: string, data: UpdatePersonInput) => Promise<void>;
  deletePerson: (id: string) => Promise<void>;
  setSearchKeyword: (keyword: string) => void;
  setSortBy: (sortBy: 'createdAt' | 'birthday') => void;
  fetchTodayBirthdays: () => Promise<void>;
  clearCurrentPerson: () => void;
  reset: () => void;
}
```

---

## API 依赖

| Action | API Endpoint | Method |
|--------|--------------|--------|
| fetchPersons | `/api/persons` | GET |
| fetchPerson | `/api/persons/{id}` | GET |
| createPerson | `/api/persons` | POST |
| updatePerson | `/api/persons/{id}` | PUT |
| deletePerson | `/api/persons/{id}` | DELETE |
| fetchTodayBirthdays | `/api/persons/birthdays/today` | GET |
