import 'regenerator-runtime/runtime'
import { set, reset } from 'mockdate'

class EventStatus {
    value: 'active' | 'inReview' | 'done'

    constructor(event?: { endDate: Date, reviewDurationInHours: number }) {
        if (event === undefined) {
            this.value = 'done'
            return
        }
        const now = new Date()
        if (event.endDate >= now) {
            this.value = 'active'
            return
        }
        const reviewDurationInMs = event.reviewDurationInHours * 60 * 60 * 1000
        const reviewDate = new Date(event.endDate.getTime() + reviewDurationInMs)
        this.value = reviewDate >= now ? 'inReview' : 'done'
    }
}

class CheckLastEventStatus {
    constructor(private readonly loadLastEventRepository: LoadLastEventRepository) { }

    async perform({ groupId }: { groupId: string }): Promise<EventStatus> {
        const event = await this.loadLastEventRepository.loadLastEvent({ groupId })
        return new EventStatus(event)
    }
}

interface LoadLastEventRepository {
    loadLastEvent: (input: { groupId: string }) => Promise<{ endDate: Date, reviewDurationInHours: number } | undefined>
}

class LoadLastEventRepositorySpy implements LoadLastEventRepository {
    groupId?: string
    callsCount = 0
    output?: { endDate: Date, reviewDurationInHours: number }

    async loadLastEvent({ groupId }: { groupId: string }): Promise<{ endDate: Date, reviewDurationInHours: number } | undefined> {
        this.groupId = groupId
        this.callsCount++
        return this.output
    }
}

type SutOutput = {
    sut: CheckLastEventStatus
    loadLastEventRepository: LoadLastEventRepositorySpy
}

const makeSut = (): SutOutput => {
    const loadLastEventRepository = new LoadLastEventRepositorySpy()
    const sut = new CheckLastEventStatus(loadLastEventRepository)
    return { sut, loadLastEventRepository }
}

describe('CheckLastEventStatus', () => {
    const groupId = 'any_group_id'
    beforeAll(() => {
        set(new Date())
    })

    afterAll(() => {
        reset()
    })

    it('should get last event data', async () => {
        const { sut, loadLastEventRepository } = makeSut()

        await sut.perform({ groupId })

        expect(loadLastEventRepository.groupId).toBe(groupId)
        expect(loadLastEventRepository.callsCount).toBe(1)
    })

    it('should return status done when group has no event', async () => {
        const { sut, loadLastEventRepository } = makeSut()
        loadLastEventRepository.output = undefined

        const eventStatus = await sut.perform({ groupId })

        expect(eventStatus.value).toBe('done')
    })

    it('should return status active when now is before event end time', async () => {
        const { sut, loadLastEventRepository } = makeSut()
        loadLastEventRepository.output = {
            endDate: new Date(new Date().getTime() + 1),
            reviewDurationInHours: 1
        }

        const eventStatus = await sut.perform({ groupId })

        expect(eventStatus.value).toBe('active')
    })

    it('should return status active when now is equal to event end time', async () => {
        const { sut, loadLastEventRepository } = makeSut()
        loadLastEventRepository.output = {
            endDate: new Date(),
            reviewDurationInHours: 1
        }

        const eventStatus = await sut.perform({ groupId })

        expect(eventStatus.value).toBe('active')
    })

    it('should return status inReview when now is after event end time', async () => {
        const { sut, loadLastEventRepository } = makeSut()
        loadLastEventRepository.output = {
            endDate: new Date(new Date().getTime() - 1),
            reviewDurationInHours: 1
        }
        const eventStatus = await sut.perform({ groupId })

        expect(eventStatus.value).toBe('inReview')
    })

    it('should return status inReview when now is before end of review time', async () => {
        const { sut, loadLastEventRepository } = makeSut()
        const reviewDurationInHours = 1
        const reviewDurationInMs = reviewDurationInHours * 60 * 60 * 1000
        loadLastEventRepository.output = {
            endDate: new Date(new Date().getTime() - reviewDurationInMs + 1),
            reviewDurationInHours
        }

        const eventStatus = await sut.perform({ groupId })

        expect(eventStatus.value).toBe('inReview')
    })

    it('should return status inReview when now is equal to end of review time', async () => {
        const { sut, loadLastEventRepository } = makeSut()
        const reviewDurationInHours = 1
        const reviewDurationInMs = reviewDurationInHours * 60 * 60 * 1000
        loadLastEventRepository.output = {
            endDate: new Date(new Date().getTime() - reviewDurationInMs),
            reviewDurationInHours
        }

        const eventStatus = await sut.perform({ groupId })

        expect(eventStatus.value).toBe('inReview')
    })

    it('should return status done when now is after end of review time', async () => {
        const { sut, loadLastEventRepository } = makeSut()
        const reviewDurationInHours = 1
        const reviewDurationInMs = reviewDurationInHours * 60 * 60 * 1000
        loadLastEventRepository.output = {
            endDate: new Date(new Date().getTime() - reviewDurationInMs - 1),
            reviewDurationInHours
        }

        const eventStatus = await sut.perform({ groupId })

        expect(eventStatus.value).toBe('done')
    })
})