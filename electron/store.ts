import { app } from 'electron';
import path from 'path';
import fs from 'fs';

export class Store {
    private path: string;
    private data: any;

    constructor(fileName: string) {
        const userDataPath = app.getPath('userData');
        this.path = path.join(userDataPath, fileName);
        this.data = parseDataFile(this.path, {});
    }

    get(key: string, defaultValue?: any) {
        return this.data[key] !== undefined ? this.data[key] : defaultValue;
    }

    set(key: string, val: any) {
        this.data[key] = val;
        fs.writeFileSync(this.path, JSON.stringify(this.data));
    }

    getAll() {
        return this.data;
    }
}

function parseDataFile(filePath: string, defaults: any) {
    try {
        return JSON.parse(fs.readFileSync(filePath).toString());
    } catch (error) {
        return defaults;
    }
}

export const settingsStore = new Store('settings.json');
