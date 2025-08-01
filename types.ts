export type Options = {
    key: Buffer;
    cert: Buffer;
    rejectUnauthorized?: boolean;
};


export type RegisterBody = {
    name: string;
    email: string;
    password: string;
    
}


export type LoginBody = {
    email: string;
    password: string;
}

export type CodeBody = {
    email: string;
}

export type ChangePasswordBody = {
    code: number;
    password: string;
    email: string;
}


export type MessageType = {
    side: "left" | "right",
    message: string,
    loading?: boolean;
}

export type BrowserUser = {
    uuid: string;
    name: string;
    email: string;
    highestScore: number;
    timesTaken: number;
    testsAvailable: number;
    allTests: any[];
    imgUrl: string;

}

export type Test = {
    uuid: string,
    fullTest: {
        mcqQuestions: any[],
        slideIntoDmsQuestions: any[],
        realTimeLiveQuestion: any
    };
}


export type TestList = {
    uuid: "ALL_TESTS",
    testList: string[]
}

export type User = {
    uuid: string;
    name: string;
    emailHash: string;
    email: string;
    password: string;
    passwordCode?: number;
    imgUrl: string;
    timesTaken: number;
    highestScore: number;
    testsAvailable: number;

    allTests: string[];

}


// At the function
export type LocateEntryType = Promise<User | User[] | "">;


// At function call
export type LocateEntryEntry =  "" | User | User[];


