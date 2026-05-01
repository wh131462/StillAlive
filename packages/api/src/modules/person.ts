import type {
  CreatePersonRequest,
  ImportantDate,
  Person,
  PersonGroup,
  SharedMemory,
} from '@stillalive/types';
import type { HttpClient } from '../client';

export class PersonApi {
  constructor(private http: HttpClient) {}

  list(params?: { groupId?: string }) {
    return this.http.get<Person[]>('/people', params);
  }

  detail(id: string) {
    return this.http.get<Person>(`/people/${id}`);
  }

  create(data: CreatePersonRequest) {
    return this.http.post<Person>('/people', data);
  }

  update(id: string, data: Partial<CreatePersonRequest>) {
    return this.http.put<Person>(`/people/${id}`, data);
  }

  remove(id: string) {
    return this.http.delete<null>(`/people/${id}`);
  }

  groups() {
    return this.http.get<PersonGroup[]>('/person-groups');
  }

  todayBirthdays() {
    return this.http.get<Person[]>('/people/birthdays/today');
  }

  importantDates(personId: string) {
    return this.http.get<ImportantDate[]>(`/people/${personId}/dates`);
  }

  sharedMemories(personId: string) {
    return this.http.get<SharedMemory[]>(`/people/${personId}/memories`);
  }
}
