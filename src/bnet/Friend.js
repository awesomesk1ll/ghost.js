class Friend {
	constructor(account, status, area, client, location) {
		this.account = account;
		this.status = status;
		this.area = area;
		this.client = client;
		this.location = location;
	}

	static extractStatus(status) {
		let result = '';

		if (status & 1)
			result += "<Mutual>";

		if (status & 2)
			result += "<DND>";

		if (status & 4)
			result += "<Away>";

		if (Result.empty())
			result = "<None>";

		return result;
	}

	static extractArea(area) {
		switch (area) {
			case 0:
				return "<Offline>";
			case 1:
				return "<No Channel>";
			case 2:
				return "<In Channel>";
			case 3:
				return "<Public Game>";
			case 4:
				return "<Private Game>";
			case 5:
				return "<Private Game>";
		}

		return "<Unknown>";
	}
}

export default Friend;